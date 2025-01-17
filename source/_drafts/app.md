---
title: AMS启动界面
date: 2022-11-17 17:47:29
categories: Android Framework
tags:
 - AOSP
banner_img: img/cover/cover-ams1.webp
---

前面看过`AMS`的启动流程，我们知道`AMS`管理应用进程以及四大组件等信息，但是具体细节并未仔细查看。因为`AMS`作为一个功能复杂的系统服务，它与很多服务之间都有着直接或者间接的关联，导致分析起来很复杂，因此前面只简单看了其启动服务的过程以及初始化流程，这里就着`app`的完整启动来具体查看下`AMS`起到的作用。

> 源码基于Android 13

## APP启动

`app`的启动有多种方式，但不管怎么说，`app`的进程就是与其四大组件相关联的。一个`app`的启动，必然包含了其四大组件中的某一个组件的启动，因此，`app`的启动实际上就是追踪某个组件的启动。例如当我们去启动一个`Activity`的时候，`AMS`会去判断要启动的`Activity`所处的进程是否已存在，如果不存在时，则会通知到`zygote`中，然后由`zygote`去`fork`一个新的进程，并执行`ActivityThread#main`方法。

```java
// frameworks/base/core/java/android/app/ActivityThread.java

public static void main(String[] args) {
        ...
        // 开启主循环
        Looper.prepareMainLooper();
        ...
        ActivityThread thread = new ActivityThread();
        thread.attach(false, startSeq);

        if (sMainThreadHandler == null) {
            sMainThreadHandler = thread.getHandler();
        }
        ...
        Looper.loop();
        // 主线程不会退出
        throw new RuntimeException("Main thread loop unexpectedly exited");
    }
```

当需要启动新的应用进程时，就由`zygote`进程`fork`而出一个新的进程，并调用其主函数，这里也可以称之为`app`的入口函数。这里除了启用主循环后，就是创建了一个实例对象并进行关联。

```java
    private void attach(boolean system, long startSeq) {
        sCurrentActivityThread = this;
        mConfigurationController = new ConfigurationController(this);
        // 一律是false，只有system_server进程是true
        mSystemThread = system;
        mStartSeq = startSeq;

        if (!system) {
            // app进程走到这里
            ...
            // 与AMS进行关联
            final IActivityManager mgr = ActivityManager.getService();
            try {
                mgr.attachApplication(mAppThread, startSeq);
            } catch (RemoteException ex) {
                throw ex.rethrowFromSystemServer();
            }
            ...
        } else {
            // system_server进程走到这里
            ...
            try {
                // 管理activityy的活动等
                mInstrumentation = new Instrumentation();
                mInstrumentation.basicInit(this);
                // 创建Context
                ContextImpl context = ContextImpl.createAppContext(
                        this, getSystemContext().mPackageInfo);
                // 创建Application
                mInitialApplication = context.mPackageInfo.makeApplicationInner(true, null);
                mInitialApplication.onCreate();
            } catch (Exception e) {
                throw new RuntimeException(
                        "Unable to instantiate Application():" + e.toString(), e);
            }
        }
        ...
    }
```

对于`app`进程，这里会直接将`ApplicationThread`与`AMS`进行关联，对于`system_server`进程，则是创建对应的`Context`和`Application`，本质上确实是与应用一样，因此它本身也可以看做是一个应用，事实上`AMS`也确实把他当做一个应用的。

回到`app`进程逻辑，`mAppThread`是一个`ApplicationThread`实例，它是在`ActivityThread`被创建出来的时候同时创建出来的。同时，它也是一个`Binder`对象，是通过`AIDL`实现的对象，因此这里实际上是将其传递给`AMS`。

```java
// frameworks/base/services/core/java/com/android/server/am/ActivityManagerService.java

    @Override
    public final void attachApplication(IApplicationThread thread, long startSeq) {
        if (thread == null) {
            throw new SecurityException("Invalid application interface");
        }
        synchronized (this) {
            int callingPid = Binder.getCallingPid();
            final int callingUid = Binder.getCallingUid();
            final long origId = Binder.clearCallingIdentity();
            attachApplicationLocked(thread, callingPid, callingUid, startSeq);
            Binder.restoreCallingIdentity(origId);
        }
    }
```

这里获取到调用方法的一些信息后，直接通过`attachApplicationLocked`方法进入到实际的实现逻辑中，该方法流程非常长，这里一点点的查看。

```java
// frameworks/base/services/core/java/com/android/server/am/ActivityManagerService.java

private boolean attachApplicationLocked(@NonNull IApplicationThread thread,
            int pid, int callingUid, long startSeq) {

        ProcessRecord app;
        long startTime = SystemClock.uptimeMillis();
        long bindApplicationTimeMillis;
        if (pid != MY_PID && pid >= 0) {
            // 从当前进程记录中以pid进行查询
            synchronized (mPidsSelfLocked) {
                app = mPidsSelfLocked.get(pid);
            }
            if (app != null && (app.getStartUid() != callingUid || app.getStartSeq() != startSeq)) {
                ...
                // 如果查到了，但是调用方是别的进程，则清楚记录
                cleanUpApplicationRecordLocked(app, pid, false, false, -1,
                        true /*replacingPid*/, false /* fromBinderDied */);
                removePidLocked(pid, app);
                app = null;
            }
        } else {
            app = null;
        }

        // 从ProcessList的mPendingStarts中查询，该集合是在启动前就已经由启动的
        // 进程添加进来的
        if (app == null && startSeq > 0) {
            final ProcessRecord pending = mProcessList.mPendingStarts.get(startSeq);
            if (pending != null && pending.getStartUid() == callingUid
                    && pending.getStartSeq() == startSeq
                    // 将其从mPendingStarts移除并添加到mPidsSelfLocked中
                    && mProcessList.handleProcessStartedLocked(pending, pid,
                        pending.isUsingWrapper(), startSeq, true)) {
                app = pending;
            }
        }

        if (app == null) {
            // 如果还是查不到，则说明该进程有问题，直接杀掉进程
            EventLogTags.writeAmDropProcess(pid);
            if (pid > 0 && pid != MY_PID) {
                killProcessQuiet(pid);
            } else {
                try {
                    thread.scheduleExit();
                } catch (Exception e) {
                }
            }
            return false;
        }
        ...
        synchronized (mProcLock) {
            app.mState.setCurAdj(ProcessList.INVALID_ADJ);
            app.mState.setSetAdj(ProcessList.INVALID_ADJ);
            app.mState.setVerifiedAdj(ProcessList.INVALID_ADJ);
            mOomAdjuster.setAttachingSchedGroupLSP(app);
            app.mState.setForcingToImportant(null);
            updateProcessForegroundLocked(app, false, 0, false);
            app.mState.setHasShownUi(false);
            app.mState.setCached(false);
            app.setDebugging(false);
            app.setKilledByAm(false);
            app.setKilled(false);
            app.setUnlocked(StorageManager.isUserKeyUnlocked(app.userId));
        }


        ...
                thread.bindApplication(processName, appInfo,
                        app.sdkSandboxClientAppVolumeUuid, app.sdkSandboxClientAppPackage,
                        providerList, null, profilerInfo, null, null, null, testMode,
                        mBinderTransactionTrackingEnabled, enableTrackAllocation,
                        isRestrictedBackupMode || !normalMode, app.isPersistent(),
                        new Configuration(app.getWindowProcessController().getConfiguration()),
                        app.getCompat(), getCommonServicesLocked(app.isolated),
                        mCoreSettingsObserver.getCoreSettingsLocked(),
                        buildSerial, autofillOptions, contentCaptureOptions,
                        app.getDisabledCompatChanges(), serializedSystemFontMap,
                        app.getStartElapsedTime(), app.getStartUptime());
       ...
            

            
            // 将ApplicationThread记录在ProcessRecord中，后续就可以以此进行交互
            synchronized (mProcLock) {
                app.makeActive(thread, mProcessStats);
              
            }
            // 更新最近使用应用列表
            updateLruProcessLocked(app, false, null);
            
        } catch (Exception e) {
            ...
            return false;
        }
        ...
        return true;
    }
```









