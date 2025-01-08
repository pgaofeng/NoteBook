---
title: Java服务总管-system_server进程
date: 2022-09-21 20:16:47
categories: Android Framework
tags:
 - AOSP
banner_img: img/cover/cover-system-server.webp
---

`system_server`进程管理着`Java`世界的服务，主要分为`boot`服务、核心服务以及其他服务。开机时由`init`进程拉起`zygote`，最终走到`java`世界的`zygote`。后续所有的`java`进程都是由`zygote`直接或间接孵化而出，而`system_server`就是`zygote`孵化出的第一个进程。这个流程可以查看前面的[Java进程祖先-zygote服务](https://pgaofeng.github.io/2022/08/12/zygote/)，后续其他服务就是由`system_server`启动的。

> 源码基于Android 13

## system_server

它是`zygote`孵化出的第一个进程，当`system_server`被`fork`出之后，`zygote`就不再直接`fork`其他进程了，而是进入循环阻塞状态，等待`socket`的消息来决定什么时候`fork`新进程。而`system_server`进程启动后，就走到其主函数中开始了它自己的流程。

```java
// frameworks/base/services/java/com/android/server/SystemServer.java

public final class SystemServer implements Dumpable {
    // dump服务
    private final SystemServerDumper mDumper = new SystemServerDumper();
    
    public static void main(String[] args) {
        new SystemServer().run();
    }
    ...
    private void run() {
        try {
            t.traceBegin("InitBeforeStartServices");
            ...
            // 开启Looper机制
            Looper.prepareMainLooper();
            ...
            // 初始化systemContext
            createSystemContext();
            ...
            // 加入dumper服务，该服务用于adb shell dumpsys命令
            ServiceManager.addService("system_server_dumper", mDumper);
            mDumper.addDumpable(this);

            // 系统服务管理者
            mSystemServiceManager = new SystemServiceManager(mSystemContext);
            mSystemServiceManager.setStartInfo(mRuntimeRestart,
                    mRuntimeStartElapsedTime, mRuntimeStartUptime);
            // 加入到dumper中
            mDumper.addDumpable(mSystemServiceManager);
            // 加入到本地service中
            LocalServices.addService(SystemServiceManager.class, mSystemServiceManager);
            // 初始化线程池
            SystemServerInitThreadPool tp = SystemServerInitThreadPool.start();
            mDumper.addDumpable(tp);
        } finally {
            t.traceEnd();  // InitBeforeStartServices
        }

        try {
            // 启动主要的一些服务
            startBootstrapServices(t);
            startCoreServices(t);
            startOtherServices(t);
            startApexServices(t);
        } catch (Throwable ex) {
            throw ex;
        } finally {
            t.traceEnd(); // StartServices
        }
        ...
        // 进入死循环等待，后续由handler机制唤醒执行操作
        Looper.loop();
        throw new RuntimeException("Main thread loop unexpectedly exited");
    }
}
```

整个`system_server`进程也是通过`Looper`机制进入循环等待的，关于Looper的可以查看[Handler从Java到Native](https://pgaofeng.github.io/2022/03/07/handler/)。它在启动中做了很多的操作，其中几乎都是我们需要关注的，如创建上下文以及注册`dump`等，我们一点一点的查看。

### 注册dump

```java
// frameworks/base/services/java/com/android/server/SystemServer.java

public final class SystemServer implements Dumpable {
    ...
	private final class SystemServerDumper extends Binder {

        // 存放多Dumpable，这些是具体用来打印输入信息的
        @GuardedBy("mDumpables")
        private final ArrayMap<String, Dumpable> mDumpables = new ArrayMap<>(4);

        @Override
        protected void dump(FileDescriptor fd, PrintWriter pw, String[] args) {
            final boolean hasArgs = args != null && args.length > 0;

            synchronized (mDumpables) {
                // adb shell dumpsys system_server_dumper --list
                // 列出system_server_dumper的所有Dumpable
                if (hasArgs && "--list".equals(args[0])) {
                    final int dumpablesSize = mDumpables.size();
                    for (int i = 0; i < dumpablesSize; i++) {
                        pw.println(mDumpables.keyAt(i));
                    }
                    return;
                }

                // adb shell dumpsys system_server_dumper --name SystemServer
                // --name后面跟具体的Dumpable
                if (hasArgs && "--name".equals(args[0])) {
                    if (args.length < 2) {
                        pw.println("Must pass at least one argument to --name");
                        return;
                    }
                    final String name = args[1];
                    final Dumpable dumpable = mDumpables.get(name);
                    if (dumpable == null) {
                        pw.printf("No dummpable named %s\n", name);
                        return;
                    }

                    try (IndentingPrintWriter ipw = new IndentingPrintWriter(pw, "  ")) {
                        // Strip --name DUMPABLE from args
                        final String[] actualArgs = Arrays.copyOfRange(args, 2, args.length);
                        dumpable.dump(ipw, actualArgs);
                    }
                    return;
                }

                // adb shell dumpsys system_server_dumper
                // 后后缀会dump出所有的信息
                final int dumpablesSize = mDumpables.size();
                try (IndentingPrintWriter ipw = new IndentingPrintWriter(pw, "  ")) {
                    for (int i = 0; i < dumpablesSize; i++) {
                        final Dumpable dumpable = mDumpables.valueAt(i);
                        ipw.printf("%s:\n", dumpable.getDumpableName());
                        ipw.increaseIndent();
                        dumpable.dump(ipw, args);
                        ipw.decreaseIndent();
                        ipw.println();
                    }
                }
            }
        }

        // 添加新的dumpable
        private void addDumpable(@NonNull Dumpable dumpable) {
            synchronized (mDumpables) {
                mDumpables.put(dumpable.getDumpableName(), dumpable);
            }
        }
    }
}
```

`dump`服务是有多个的，用于我们的命令`adb shell dump`，后面跟的就是`dump`服务的名字，我们可以从`dump`服务中查询各种信息。如在`system_server`进程启动中，注册的就是名为`system_server_dumper`的一个服务，从类中可以看到它是`SystemServer`的内部类，但是它继承自`Binder`，也就是说它是一个`Binder`服务，是可以注册到`ServiceManager`中的。

```java
// frameworks/base/core/java/android/os/ServiceManager.java

public final class ServiceManager {
    // 包装了从native层的ServiceManager到Java层的过程，包括查询服务，注册服务等
    ...
}
```

这里的`ServiceManager`是封装了`native`层的`ServiceManager`，使得我们可以直接使用而不用关注`native`层是如何实现的。这里主要就是通过`ServiceManager`注册了`system_server_dumper`服务就结束了。

#### SystemServiceManager

在注册了`system_server_dumper`后，紧接着又创建了一个`SystemServiceManager`，并加入到了本地的服务中。注意这里只是加入到了本地的服务列表中，并没有通过`ServiceManager`去注册服务，因为它并不是`Binder`，因此也就无法注册。

```java
// frameworks/base/services/core/java/com/android/server/SystemServiceManager.java
public final class SystemServiceManager implements Dumpable {
    ...
}

// frameworks/base/core/java/com/android/server/LocalServices.java
public final class LocalServices {
    private LocalServices() {}
    // 存放本地服务，注意key是class
    private static final ArrayMap<Class<?>, Object> sLocalServiceObjects =
            new ArrayMap<Class<?>, Object>();

    // 获取服务
    @SuppressWarnings("unchecked")
    public static <T> T getService(Class<T> type) {
        synchronized (sLocalServiceObjects) {
            return (T) sLocalServiceObjects.get(type);
        }
    }

    // 添加服务
    public static <T> void addService(Class<T> type, T service) {
        synchronized (sLocalServiceObjects) {
            if (sLocalServiceObjects.containsKey(type)) {
                throw new IllegalStateException("Overriding service registration");
            }
            sLocalServiceObjects.put(type, service);
        }
    }

    // 移除服务
    @VisibleForTesting
    public static <T> void removeServiceForTest(Class<T> type) {
        synchronized (sLocalServiceObjects) {
            sLocalServiceObjects.remove(type);
        }
    }
}
```

因为不是远程的`Binder`服务，因此无法注册到`ServiceManager`中，所以这里注册到`LocalServices`中。这里的`LocalServices`维护了一个静态`map`用于存储本地服务，注意这里的**`SystemServiceManager`**服务的`key`是**`SystemServer.class`**。该服务的主要作用就是维护其他服务，以及启动其他服务等，这里后面我们再继续查看。

### 批量启动服务

最后也就是`system_server`的最主要的流程了，就是启动各种服务，注意这里的服务并不是Binder服务，而是Java层中定义的服务，它们并不能注册到`ServiceManager`中的。

#### boot服务

这里启动的是系统启动引导服务，是非常重要的一系列服务。

```java
// frameworks/base/services/java/com/android/server/SystemServer.java

public final class SystemServer implements Dumpable {

    private void startBootstrapServices(@NonNull TimingsTraceAndSlog t) {
        t.traceBegin("startBootstrapServices");

        // 看门狗服务，该服务用于保障其他服务的正常运行
        final Watchdog watchdog = Watchdog.getInstance();
        watchdog.start();
        ...
        ActivityTaskManagerService atm = mSystemServiceManager.startService(
                ActivityTaskManagerService.Lifecycle.class).getService();
        mActivityManagerService = ActivityManagerService.Lifecycle.startService(
                mSystemServiceManager, atm);
        mActivityManagerService.setSystemServiceManager(mSystemServiceManager);
        ...
        mPowerManagerService = mSystemServiceManager.startService(PowerManagerService.class);
        ...
        mActivityManagerService.initPowerManagement();
        ...
        IPackageManager iPackageManager;
        t.traceBegin("StartPackageManagerService");
        try {
            Watchdog.getInstance().pauseWatchingCurrentThread("packagemanagermain");
            Pair<PackageManagerService, IPackageManager> pmsPair = PackageManagerService.main(
                    mSystemContext, installer, domainVerificationService,
                    mFactoryTestMode != FactoryTest.FACTORY_TEST_OFF, mOnlyCore);
            mPackageManagerService = pmsPair.first;
            iPackageManager = pmsPair.second;
        } finally {
            Watchdog.getInstance().resumeWatchingCurrentThread("packagemanagermain");
        }
        ...
    }
}
```

这里启动和很多的服务，也有很多我们常见的一些服务，这里先不去关注这些服务具体做了什么，我们先看两点，一是如何启动的服务，另外就是看门狗是怎么保证这些服务的正常运行的。

```java
// frameworks/base/services/core/java/com/android/server/SystemServiceManager.java
public final class SystemServiceManager implements Dumpable {
    // 启动服务
    public <T extends SystemService> T startService(Class<T> serviceClass) {
        try {
            final String name = serviceClass.getName();
            // 反射调用构造方法获取service实例
            final T service;
            try {
                Constructor<T> constructor = serviceClass.getConstructor(Context.class);
                service = constructor.newInstance(mContext);
            }...

            startService(service);
            return service;
        } finally {
            Trace.traceEnd(Trace.TRACE_TAG_SYSTEM_SERVER);
        }
    }
    
    public void startService(@NonNull final SystemService service) {
        // 已经启动过了就不需要再启动一份了
        String className = service.getClass().getName();
        if (mServiceClassnames.contains(className)) {
            Slog.i(TAG, "Not starting an already started service " + className);
            return;
        }
        // 将服务名字添加到集合中
        mServiceClassnames.add(className);
        // 将服务添加到集合中
        mServices.add(service);

        long time = SystemClock.elapsedRealtime();
        try {
            // 执行onStart
            service.onStart();
        } catch (RuntimeException ex) {
            throw new RuntimeException("Failed to start service " + service.getClass().getName()
                    + ": onStart threw an exception", ex);
        }
        warnIfTooLong(SystemClock.elapsedRealtime() - time, service, "onStart");
    }
}
```

因为这些服务都是继承自`SystemService`的，所以启动服务就是通过`class`反射调用构造方法，获取到实例，并加入到本地的一个集合中保存用于避免重复启动服务，而实际的启动服务就是执行其`onStart`方法而已。下面我们用`PowerMS`作为示例查看下：

```java
// frameworks/base/services/core/java/com/android/server/power/PowerManagerService.java
public final class PowerManagerService extends SystemService
        implements Watchdog.Monitor {
    
    @Override
    public void onStart() {
        // 注册了一个远程服务，一个本地服务
        publishBinderService(Context.POWER_SERVICE, mBinderService, /* allowIsolated= */ false,
                DUMP_FLAG_PRIORITY_DEFAULT | DUMP_FLAG_PRIORITY_CRITICAL);
        publishLocalService(PowerManagerInternal.class, mLocalService);
        // 将自己添加到看门狗中
        Watchdog.getInstance().addMonitor(this);
        Watchdog.getInstance().addThread(mHandler);
    }
    
    @Override // Watchdog.Monitor implementation
    public void monitor() {
        // Grab and release lock for watchdog monitor to detect deadlocks.
        synchronized (mLock) {
        }
    }
}
```

可以看到`PowerMS`确实是继承自`SystemService`的，实际上所有的通过`SystemServiceManager`启动的服务都应该要继承自`SystemService`。在`PowerMS`的`onStart`中，注册了远程`Binder`服务以及本地服务，然后就是将自己以及Handler加入到了看门狗中。那么，看门狗又是如何监控的呢？

```java
// frameworks/base/services/core/java/com/android/server/Watchdog.java

public class Watchdog implements Dumpable {
    // 添加监控者，这里是PowerMS
    public void addMonitor(Monitor monitor) {
        synchronized (mLock) {
            mMonitorChecker.addMonitorLocked(monitor);
        }
    }
    // 添加线程
    public void addThread(Handler thread) {
        synchronized (mLock) {
            final String name = thread.getLooper().getThread().getName();
            mHandlerCheckers.add(withDefaultTimeout(new HandlerChecker(thread, name)));
        }
    }
    
    // 获取实例
    public static Watchdog getInstance() {
        if (sWatchdog == null) {
            sWatchdog = new Watchdog();
        }
        return sWatchdog;
    }

    // 构造方法
    private Watchdog() {
        // 创建了看门狗线程
        mThread = new Thread(this::run, "watchdog");
        mMonitorChecker = new HandlerChecker(FgThread.getHandler(),
                "foreground thread");
        ...
    }
    
    // 开启看门狗，实际就是开启线程
    public void start() {
        mThread.start();
    }
    
    // 开启看门狗后线程执行的方法
    private void run() {
        boolean waitedHalf = false;

        while (true) {
            List<HandlerChecker> blockedCheckers = Collections.emptyList();
            String subject = "";
            boolean allowRestart = true;
            int debuggerWasConnected = 0;
            boolean doWaitedHalfDump = false;
            // 超时时间以及检测间隔
            final long watchdogTimeoutMillis = mWatchdogTimeoutMillis;
            final long checkIntervalMillis = watchdogTimeoutMillis / 2;
            final ArrayList<Integer> pids;
            synchronized (mLock) {
                long timeout = checkIntervalMillis;
                // 遍历要检测的线程，前面我们addThread加入的就是这里
                for (int i=0; i<mHandlerCheckers.size(); i++) {
                    HandlerCheckerAndTimeout hc = mHandlerCheckers.get(i);
                    // 执行方法
                    hc.checker().scheduleCheckLocked(hc.customTimeoutMillis()
                            .orElse(watchdogTimeoutMillis * Build.HW_TIMEOUT_MULTIPLIER));
                }

               
                long start = SystemClock.uptimeMillis();
                while (timeout > 0) {
                    try {
                        // 进入等待状态，并设置超时时间
                        mLock.wait(timeout);
                    } catch (InterruptedException e) {
                        Log.wtf(TAG, e);
                    }
                    timeout = checkIntervalMillis - (SystemClock.uptimeMillis() - start);
                }
                // 评估所有任务的状态
                final int waitState = evaluateCheckerCompletionLocked();
                if (waitState == COMPLETED) {
                    // 任务都完成了
                    waitedHalf = false;
                    continue;
                } else if (waitState == WAITING) {
                    // 有任务还未完成，并且等待时长还未超过超时时间的一半
                    continue;
                } else if (waitState == WAITED_HALF) {
                    // 有任务还未完成，并且等待时间超过了超时时间的一半
                    if (!waitedHalf) {
                        Slog.i(TAG, "WAITED_HALF");
                        waitedHalf = true;
                        // We've waited half, but we'd need to do the stack trace dump w/o the lock.
                        blockedCheckers = getCheckersWithStateLocked(WAITED_HALF);
                        subject = describeCheckersLocked(blockedCheckers);
                        pids = new ArrayList<>(mInterestingJavaPids);
                        doWaitedHalfDump = true;
                    } else {
                        continue;
                    }
                } else {
                    // something is overdue!
                    blockedCheckers = getCheckersWithStateLocked(OVERDUE);
                    subject = describeCheckersLocked(blockedCheckers);
                    allowRestart = mAllowRestart;
                    pids = new ArrayList<>(mInterestingJavaPids);
                }
            } // END synchronized (mLock)

            waitedHalf = false;
        }
    }
}
```

也就是当`WatchDog`创建出来并启动时，会在子线程中开始一个死循环，并循环处理`HandlerCheckerAndTimeout`消息。这个消息就是我们添加监控时传递进来的，当通过`addThread`添加监控时，会构建一个`HandlerCheckerAndTimeout`，然后加入到它的内部类`HandlerChecker`中。然后死循环中就是遍历这个集合去执行任务。

```java
public void scheduleCheckLocked(long handlerCheckerTimeoutMillis) {
    mWaitMax = handlerCheckerTimeoutMillis;
    if (mCompleted) {
        // 当前处于完成状态，把monitor队列添加到集合中
        mMonitors.addAll(mMonitorQueue);
        mMonitorQueue.clear();
    }
    // 没有可执行的monitor，说明任务完成
    if ((mMonitors.size() == 0 && mHandler.getLooper().getQueue().isPolling())
            || (mPauseCount > 0)) {
        mCompleted = true;
        return;
    }
    if (!mCompleted) {
        // 如果是未完成状态，不需要再次执行
        return;
    }
    // 标记为未完成状态
    mCompleted = false;
    mCurrentMonitor = null;
    mStartTime = SystemClock.uptimeMillis();
    // 开始执行任务
    mHandler.postAtFrontOfQueue(this);
}

@Override
public void run() {
    final int size = mMonitors.size();
    // 执行所有的monitor
    for (int i = 0 ; i < size ; i++) {
        synchronized (mLock) {
            mCurrentMonitor = mMonitors.get(i);
        }
        mCurrentMonitor.monitor();
    }
     synchronized (mLock) {
        mCompleted = true;
        mCurrentMonitor = null;
    }
}
```

