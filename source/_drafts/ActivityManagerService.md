---
title: App管理服务-ActivityManagerService
date: 2022-10-02 15:21:11
categories: Android Framework
tags:
 - AOSP
banner_img: img/cover/cover-ams.webp
---

`ActivityManagerService`（俗称`AMS`）是一个非常重要的系统服务，它是在`SystemServer`中被启动的进程之一。作用及其广泛，主管的就是应用`App`的四大组件以及进程信息，可以说它管理着`app`世界的所有应用。`zygote`孵化所有`java`进程，`system_server`管理所有服务，`AMS`管理所有`app`进程。

> 源码基于Android 13

### ActivityManagerService

`AMS`作为一个系统服务，也是在`SystemServer`中启动的，并且属于是`bootstrap`类型的服务，会被添加到`WatchDog`的监控中。通常情况下，这些服务都是由`SystemServiceManager`通过反射启动的，这里也不例外。这里我们可以看下其启动流程：

```java
// frameworks/base/services/java/com/android/server/SystemServer.java

public final class SystemServer implements Dumpable {
    private void startBootstrapServices(@NonNull TimingsTraceAndSlog t) {
        ...
        // ATMS启动
        ActivityTaskManagerService atm = mSystemServiceManager.startService(
                ActivityTaskManagerService.Lifecycle.class).getService();
        // AMS启动
        mActivityManagerService = ActivityManagerService.Lifecycle.startService(
                mSystemServiceManager, atm);
        mActivityManagerService.setSystemServiceManager(mSystemServiceManager);
        mActivityManagerService.setInstaller(installer);
        ...
        // 设置SystemServer进程
        mActivityManagerService.setSystemProcess();
    }
    
    private void startOtherServices(@NonNull TimingsTraceAndSlog t) {
        // 安装provider
        mActivityManagerService.getContentProviderHelper().installSystemProviders();
        ...
        // 设置WMS
        mActivityManagerService.setWindowManager(wm);
        ...
        // AMS完成之后的回调
        mActivityManagerService.systemReady(() -> {
            // 观测natice的崩溃
            try {
                mActivityManagerService.startObservingNativeCrashes();
            } catch (Throwable e) {
                reportWtf("observing native crashes", e);
            }
            ...
        }
    }
}
```

这里可以看到在启动`AMS`前还先启动了`ATMS`，然后作为参数传递给`AMS`进行启动。这里`ATMS`也是一个服务，它是由`AMS`拆分出来的专门管理`Activity`的一个服务，后面我们再单独查看，这里看下`AMS`的启动并不是直接启动的，而是经由了其`Lifecycle`间接启动。

```java
// frameworks/base/services/core/java/com/android/server/am/ActivityManagerService.java

public class ActivityManagerService extends IActivityManager.Stub
        implements Watchdog.Monitor, BatteryStatsImpl.BatteryCallback, ActivityManagerGlobalLock {
    public static final class Lifecycle extends SystemService {
        private final ActivityManagerService mService;
        private static ActivityTaskManagerService sAtm;

        public Lifecycle(Context context) {
            super(context);
            // 2. 由SystemServiceManager反射走到构造方法中
            mService = new ActivityManagerService(context, sAtm);
        }

        // 1.从SystemServer中调用该方法进行启动
        public static ActivityManagerService startService(
                SystemServiceManager ssm, ActivityTaskManagerService atm) {
            sAtm = atm;
            return ssm.startService(ActivityManagerService.Lifecycle.class).getService();
        }

        @Override
        public void onStart() {
            // 3. 构造出对象后调用其onStart
            mService.start();
        }
        ...
    }
    ...
}
```

`AMS`并不是直接被启动的，而是由其静态内部类`Lifecycle`创建并启动的。我们在前面知道，所有通过`SystemServiceManager`启动的服务都是会被添加到其内部的集合中的，因此这里添加到服务集合中的实际上是`AMS.Lifecycle`对象，只不过我们可以通过它间接获取到`AMS`而已。 接下来我们看其构造方法：

```java
// frameworks/base/services/core/java/com/android/server/am/ActivityManagerService.java

public class ActivityManagerService extends IActivityManager.Stub
        implements Watchdog.Monitor, BatteryStatsImpl.BatteryCallback, ActivityManagerGlobalLock {

    public ActivityManagerService(Context systemContext, ActivityTaskManagerService atm) {
        // systemServer线程
        mSystemThread = ActivityThread.currentActivityThread();
        mUiContext = mSystemThread.getSystemUiContext();

        // HandlerThread线程
        mHandlerThread = new ServiceThread(TAG,
                THREAD_PRIORITY_FOREGROUND, false /*allowIo*/);
        mHandlerThread.start();
        mHandler = new MainHandler(mHandlerThread.getLooper());
        // UI线程的handler
        mUiHandler = mInjector.getUiHandler(this);
       
        // 进程管理
        mProcessList = mInjector.getProcessList(this);
        mProcessList.init(this, activeUids, mPlatformCompat);
        // 性能管理
        mAppProfiler = new AppProfiler(this, BackgroundThread.getHandler().getLooper(),
                new LowMemDetector(this));
        mPhantomProcessList = new PhantomProcessList(this);
        // oom_adj用于杀进程的
        mOomAdjuster = new OomAdjuster(this, mProcessList, activeUids);

        // 广播管理
        ...
        mFgBroadcastQueue = new BroadcastQueue(this, mHandler,
                "foreground", foreConstants, false);
        mBgBroadcastQueue = new BroadcastQueue(this, mHandler,
                "background", backConstants, true);
        mBgOffloadBroadcastQueue = new BroadcastQueue(this, mHandler,
                "offload_bg", offloadConstants, true);
        mFgOffloadBroadcastQueue = new BroadcastQueue(this, mHandler,
                "offload_fg", foreConstants, true);
        mBroadcastQueues[0] = mFgBroadcastQueue;
        mBroadcastQueues[1] = mBgBroadcastQueue;
        mBroadcastQueues[2] = mBgOffloadBroadcastQueue;
        mBroadcastQueues[3] = mFgOffloadBroadcastQueue;
        // Service管理
        mServices = new ActiveServices(this);
        // ContentProvider管理
        mCpHelper = new ContentProviderHelper(this, true);
        mPackageWatchdog = PackageWatchdog.getInstance(mUiContext);
        // app崩溃管理
        mAppErrors = new AppErrors(mUiContext, this, mPackageWatchdog);
        mUidObserverController = new UidObserverController(mUiHandler);

        ...
        // Acitivity管理
        mActivityTaskManager = atm;
        mActivityTaskManager.initialize(mIntentFirewall, mPendingIntentController,
                DisplayThread.get().getLooper());
        mAtmInternal = LocalServices.getService(ActivityTaskManagerInternal.class);

        // 加入看门狗监控中
        Watchdog.getInstance().addMonitor(this);
        Watchdog.getInstance().addThread(mHandler);
        ...
    }
}
```

构造方法中主要是初始化，这里获取了三个线程，分别是系统线程也就是`SystemServer`所在的线程，然后是前台线程，最后是`UI`线程。接下来就是它的一些管理器，管理各个功能，这里大体上看下构造方法，然后回到启动方法`start`中。

```java
// frameworks/base/services/core/java/com/android/server/am/ActivityManagerService.java

public class ActivityManagerService extends IActivityManager.Stub
        implements Watchdog.Monitor, BatteryStatsImpl.BatteryCallback, ActivityManagerGlobalLock {
    private void start() {
        // 发布电池状态服务
        mBatteryStatsService.publish();
        // 发布app信息服务
        mAppOpsService.publish();
        // 发布进程状态服务
        mProcessStats.publish();
        // 将ActivityManagerInternal注册到本地服务，抽象方法，实现在其内部类InternalService中
        LocalServices.addService(ActivityManagerInternal.class, mInternal);
        // 与LocalServices类一样
        LocalManagerRegistry.addManager(ActivityManagerLocal.class,
                (ActivityManagerLocal) mInternal);
        mActivityTaskManager.onActivityManagerInternalAdded();
        mPendingIntentController.onActivityManagerInternalAdded();
        mAppProfiler.onActivityManagerInternalAdded();
        CriticalEventLog.init();
    }
}
```

其实就是注册各种服务，注意在`AMS`中的很多服务都是`Binder`服务，因此需要注册到`ServiceManager`或者作为本地服务注册到`LocalServices`中。同样的，具体细节我们后面再看，到这里算是启动完成，然后我们再次回到`SystemServer`中，接下来是设置系统进程。

```java
// frameworks/base/services/core/java/com/android/server/am/ActivityManagerService.java

public class ActivityManagerService extends IActivityManager.Stub
        implements Watchdog.Monitor, BatteryStatsImpl.BatteryCallback, ActivityManagerGlobalLock {
    public void setSystemProcess() {
        try {
            // 注册AMS，以及其他服务
            ServiceManager.addService(Context.ACTIVITY_SERVICE, this, /* allowIsolated= */ true,
                    DUMP_FLAG_PRIORITY_CRITICAL | DUMP_FLAG_PRIORITY_NORMAL | DUMP_FLAG_PROTO);
            ...

            // 获取应用信息，这里的包名固定为android，属于系统
            ApplicationInfo info = mContext.getPackageManager().getApplicationInfo(
                    "android", STOCK_PM_FLAGS | MATCH_SYSTEM_ONLY);
            mSystemThread.installSystemApplicationInfo(info, getClass().getClassLoader());

            synchronized (this) {
                // 构建一个进程记录，用于管理SystemServer进程
                ProcessRecord app = mProcessList.newProcessRecordLocked(info, info.processName,
                        false,
                        0,
                        false,
                        0,
                        null,
                        new HostingRecord(HostingRecord.HOSTING_TYPE_SYSTEM));
                app.setPersistent(true);
                app.setPid(MY_PID);
                app.mState.setMaxAdj(ProcessList.SYSTEM_ADJ);
                app.makeActive(mSystemThread.getApplicationThread(), mProcessStats);
                app.mProfile.addHostingComponentType(HOSTING_COMPONENT_TYPE_SYSTEM);
                addPidLocked(app);
                // 更新最近使用进程
                updateLruProcessLocked(app, false, null);
                // 设置oom_adj，内存不足时会根据该值杀进程
                updateOomAdjLocked(OomAdjuster.OOM_ADJ_REASON_NONE);
            }
        } catch (PackageManager.NameNotFoundException e) {
            throw new RuntimeException(
                    "Unable to find android system package", e);
        }
        ...
    }
}
```

可以看到，在这里`SystemServer`整个进程也是被当成了一个应用，其包名为`android`，然后交由`AMS`进行管理。继续往下看，就是发布系统的`ContentProvider`，这里就是从`ProcessList`中查询名为`system`的进程中的`ContentProvider`，然后进行注册。再次回到`SystemServer`中，在最后的其他进程也启动完毕后，会执行`AMS`的`ready`方法来表示其已完成启动。

到这里基本上`AMS`启动已经完成了，实际上来看`AMS`就是一个大管家类型的服务，虽然它管理很多的功能，但实际上这些功能都被拆分出一个一个的服务，由这些服务单独管理，然后`AMS`统筹处理。











