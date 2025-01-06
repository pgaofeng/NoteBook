---
title: Java进程祖先-zygote服务
date: 2022-08-12 11:38:16
categories: Android Framework
tags:
 - AOSP
banner_img: img/cover/cover-zygote.webp
---

`zygote`进程是所有`Java`进程的祖先，用户所接触到的所有的应用基本上都是`Java`应用，因此是非常重要的一个服务。同样的，他也是由`init`进程解析对应的`rc`而创建的，但是它是处于`late-init`阶段的，是在`ServiceManager`之后启动的进程。

> 源码基于Android 13

### zygote

`zygote`进程有区分32位和64位，但是基本上现在都是使用64位的了。我们可以先从它对应的`rc`文件中看下它的基础启动做了什么：

```
# system/core/rootdir/init.zygote64.rc

service zygote /system/bin/app_process64 -Xzygote /system/bin --zygote --start-system-server
    class main
    priority -20
    user root
    group root readproc reserved_disk
    socket zygote stream 660 root system
    socket usap_pool_primary stream 660 root system
    ...
```

启动了`zygote`的可执行文件，然后创建了两个`socket`，下面的配置就是`onrestart`触发器，表示当`zygote`重启时，会重启很多其他强关联的进程，这里我们不需要关注。注意看这里可执行文件名称叫做`zpp_process64`，因此我们找对应的源码时，应该去找`app_process`项目。

```c++
// frameworks/base/cmds/app_process/app_main.cpp

int main(int argc, char* const argv[])
{
    ...
    AppRuntime runtime(argv[0], computeArgBlockSize(argc, argv));
    // 忽略第一个参数，第一个参数是其本身
    argc--;
    argv++;
    ...
    int i;
    for (i = 0; i < argc; i++) {
        ...
        // 添加参数
        runtime.addOption(strdup(argv[i]));
        ALOGV("app_process main add option '%s'", argv[i]);
    }

    bool zygote = false;
    bool startSystemServer = false;
    bool application = false;
    String8 niceName;
    String8 className;

    ++i;
    while (i < argc) {
        const char* arg = argv[i++];
        if (strcmp(arg, "--zygote") == 0) {
            // 如果是zygote参数，设置名称为zygote64
            zygote = true;
            niceName = ZYGOTE_NICE_NAME;
        } else if (strcmp(arg, "--start-system-server") == 0) {
            // 启动system_server
            startSystemServer = true;
        } else if (strcmp(arg, "--application") == 0) {
            // 应用模式启动
            application = true;
        } else if (strncmp(arg, "--nice-name=", 12) == 0) {
            // 设置了niceName
            niceName = (arg + 12);
        } else if (strncmp(arg, "--", 2) != 0) {
            className = arg;
            break;
        } else {
            --i;
            break;
        }
    }

    Vector<String8> args;
    if (!className.empty()) {
        // 非zygote模式，根据application参数区分是app还是tool
        args.add(application ? String8("application") : String8("tool"));
        runtime.setClassNameAndArgs(className, argc - i, argv + i);
        ...
    } else {
        // zygote模式下
        maybeCreateDalvikCache();
        // 启动system_server
        if (startSystemServer) {
            args.add(String8("start-system-server"));
        }

        ...
        // 其他未解析的参数继续传递下去
        for (; i < argc; ++i) {
            args.add(String8(argv[i]));
        }
    }

    if (!niceName.empty()) {
        // 设置进程名为zygote
        runtime.setArgv0(niceName.c_str(), true /* setProcName */);
    }

    if (zygote) {
        // zygote模式
        runtime.start("com.android.internal.os.ZygoteInit", args, zygote);
    } else if (!className.empty()) {
        // app模式或者tool模式
        runtime.start("com.android.internal.os.RuntimeInit", args, zygote);
    } else {
        // 其他模式
        app_usage();
    }
}
```

在`app_main`中会解析一系列的参数，最终根据不同的模式来启动不同的`runtime`。在`zygote`的启动中，分为`zygote`模式和其他模式，其他模式又分为`application`和`tool`模式，这些都是根据传递的参数来决定的。对于我们从`rc`文件的启动中而言，走的是`zygote`模式。

`AppRuntime`实际是继承自`AndroidRuntime`的，因此我们可以直接看`zygote`模式的启动。

```c++
// frameworks/base/core/jni/AndroidRuntime.cpp

void AndroidRuntime::start(const char* className, const Vector<String8>& options, bool zygote)
{
    static const String8 startSystemServer("start-system-server");
    bool primary_zygote = false;

    // 查看是否是zygote模式
    for (size_t i = 0; i < options.size(); ++i) {
        if (options[i] == startSystemServer) { 
           primary_zygote = true;
           const int LOG_BOOT_PROGRESS_START = 3000;
           LOG_EVENT_LONG(LOG_BOOT_PROGRESS_START,  ns2ms(systemTime(SYSTEM_TIME_MONOTONIC)));
        }
    }

    ...
    // 设置各种系统环境

    // 初始化jni
    JniInvocation jni_invocation;
    jni_invocation.Init(NULL);
    JNIEnv* env;
    // 启动虚拟机
    if (startVm(&mJavaVM, &env, zygote, primary_zygote) != 0) {
        return;
    }
    // 虚拟机启动完成，在这里是个空方法，再AppRuntime中有重写
    onVmCreated(env);

    // 注册jni方法
    if (startReg(env) < 0) {
        ALOGE("Unable to register all android natives\n");
        return;
    }
    
    // 参数数组
    jobjectArray strArray;
    // 参数类：zygote模式下传递的是com.android.internal.os.ZygoteInit
    jstring classNameStr;
    ...
    // 将参数转换成java的参数
    

    // 执行参数类的main方法，由此进入到java中
    char* slashClassName = toSlashClassName(className != NULL ? className : "");
    jclass startClass = env->FindClass(slashClassName);
    if (startClass == NULL) {
        ALOGE("JavaVM unable to locate class '%s'\n", slashClassName);
    } else {
        jmethodID startMeth = env->GetStaticMethodID(startClass, "main",
            "([Ljava/lang/String;)V");
        if (startMeth == NULL) {
            ALOGE("JavaVM unable to find main() in '%s'\n", className);
        } else {
            // 执行静态方法main
            env->CallStaticVoidMethod(startClass, startMeth, strArray);
        }
    }
    free(slashClassName);;
    if (mJavaVM->DetachCurrentThread() != JNI_OK)
        ALOGW("Warning: unable to detach main thread\n");
    if (mJavaVM->DestroyJavaVM() != 0)
        ALOGW("Warning: VM did not shut down cleanly\n");
}
```

在`JNI`中，主要就是启动虚拟机，注册`JNI`方法，然后找到传递进来的类并调用其`main`方法，由此，进入到了`java`环境中。这里一步一步查看，启动虚拟机这一步，代码非常多，但也主要就是配置各种虚拟机参数，这里不在关注。主要看下注册`JNI`方法：

```c++
// // frameworks/base/core/jni/AndroidRuntime.cpp

/*static*/ int AndroidRuntime::startReg(JNIEnv* env)
{
    ...
    // 注册JNI方法，第一个参数是所有的注册JNI的数组
    if (register_jni_procs(gRegJNI, NELEM(gRegJNI), env) < 0) {
        env->PopLocalFrame(NULL);
        return -1;
    }
    ...
    return 0;
}

static int register_jni_procs(const RegJNIRec array[], size_t count, JNIEnv* env)
{
    for (size_t i = 0; i < count; i++) {
        if (array[i].mProc(env) < 0) {
            return -1;
        }
    }
    return 0;
}

// 这里方法非常多，这里只列出两个供分析即可
static const RegJNIRec gRegJNI[] = {
        REG_JNI(register_com_android_internal_os_RuntimeInit),
        REG_JNI(register_android_util_Log),
        ...
};

// 注册RuntimeInit类中的JNI方法
int register_com_android_internal_os_RuntimeInit(JNIEnv* env)
{
    const JNINativeMethod methods[] = {
            {"nativeFinishInit", "()V",
             (void*)com_android_internal_os_RuntimeInit_nativeFinishInit},
            {"nativeSetExitWithoutCleanup", "(Z)V",
             (void*)com_android_internal_os_RuntimeInit_nativeSetExitWithoutCleanup},
    };
    return jniRegisterNativeMethods(env, "com/android/internal/os/RuntimeInit",
        methods, NELEM(methods));
}

// 注册Log中的JNI方法
extern int register_android_util_Log(JNIEnv* env);
```

这里可以看到是动态注册的`JNI`方法，会遍历`gRegJNI`数组中的所有方法并执行，对应的方法会给对应的类注册`JNI`方法。实际上很多的方法并没有在该文件中声明，而是在具体的文件中注册的，这里通过`extern`直接引用了而已。例如`Log`类中的`JNI`方法是在`register_android_util_Log`中注册的，而该方法是在`android_util_Log.cpp`中实现的。`Framework`中的`JNI`方法都是在这里注册的，因此如果想要找对应的实现方法，可以通过这种格式来查找实现方法的位置：`包名_类型.cpp`。

当虚拟机启动后，并且完成了`JNI`方法的注册后，就该进入到`java`世界了，也就是会在`jni`中找到参数对应的类，然后找到类中的静态方法main，由此进入到`java`环境中。

```java
// frameworks/base/core/java/com/android/internal/os/ZygoteInit.java

public static void main(String[] argv) {
        ...
        Runnable caller;
        try {
            ...
            // 后续会解析参数，这里会设置为true
            boolean startSystemServer = false;
            String zygoteSocketName = "zygote";
            ...
            // 我们没传这个参数，因此值为false。不会走懒加载，而是直接加载
            if (!enableLazyPreload) {
                // 预加载：1.加载类/system/etc/preloaded-classes
                // 2. 加载多种hidl的jar
                // 3. 加载resource资源
                // 4. 加载hal
                // 5. 加载图形驱动
                // 6. 加载共享库
                // 7. 加载TextView资源以及WebView
                preload(bootTimingsTraceLog);
            }
            ...
            // 创建zygoteServer，用于接收socket消息
            zygoteServer = new ZygoteServer(isPrimaryZygote);

            if (startSystemServer) {
                // fork一个system_server
                Runnable r = forkSystemServer(abiList, zygoteSocketName, zygoteServer);

                // 对于system_server进程而言，r不为空，因此会执行run后就结束了它的逻辑。
                if (r != null) {
                    r.run();
                    return;
                }
            }
            // 这里是zygote进程的逻辑，这里会进入死循环阻塞，等待socket的消息。
            caller = zygoteServer.runSelectLoop(abiList);
        } catch (Throwable ex) {
            Log.e(TAG, "System zygote died with fatal exception", ex);
            throw ex;
        } finally {
            if (zygoteServer != null) {
                zygoteServer.closeServerSocket();
            }
        }
        // 在zygote的socket消息中，如果是fork子进程，新的子进程就会走到这里，而原来的zygote进程
        // 还是在循环阻塞等待消息中。
        if (caller != null) {
            caller.run();
        }
    }
```

在`ZygoteInit`中会先解析参数，然后预加载各种资源，尤其是预加载类，即在`/system/etc/preloaded-classes`文件中描述的各个类，这些类都是`java`虚拟机基础类以及`framework`中的类。因为后续其他的`java`进程都是从`zygote`进程`fork`出来的，所以他们不需要再次去加载了，而是直接使用即可，不仅缩短了加载时间还能保证各个进程用的都是同一套类库。

然后就是创建出一个`ZygoteServer`对象：

```java
// frameworks/base/core/java/com/android/internal/os/ZygoteServer.java

ZygoteServer(boolean isPrimaryZygote) {
        mUsapPoolEventFD = Zygote.getUsapPoolEventFD();
        // 这里是true
        if (isPrimaryZygote) {
            // 创建两个socket，这两个socket是在rc文件中定义的，这里是创建出来并listen
            mZygoteSocket = Zygote.createManagedSocketFromInitSocket(Zygote.PRIMARY_SOCKET_NAME);
            mUsapPoolSocket =
                    Zygote.createManagedSocketFromInitSocket(
                            Zygote.USAP_POOL_PRIMARY_SOCKET_NAME);
        } else {
            mZygoteSocket = Zygote.createManagedSocketFromInitSocket(Zygote.SECONDARY_SOCKET_NAME);
            mUsapPoolSocket =
                    Zygote.createManagedSocketFromInitSocket(
                            Zygote.USAP_POOL_SECONDARY_SOCKET_NAME);
        }

        mUsapPoolSupported = true;
        fetchUsapPoolPolicyProps();
    }
```

`ZygoteServer`是用来监听名为`zygote`的`socket`，它是在`rc`文件中定义的，后续与其他进程的交互就是通过其处理的。我们先放在这里，继续看后续的流程，在`zygote`的后续，就是`fork`出`system_server`：

```java
// frameworks/base/core/java/com/android/internal/os/ZygoteInit.java

    private static Runnable forkSystemServer(String abiList, String socketName,
            ZygoteServer zygoteServer) {
        ...
        // system_server的启动参数
        String[] args = {
                "--setuid=1000",
                "--setgid=1000",
                "--setgroups=1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1018,1021,1023,"
                        + "1024,1032,1065,3001,3002,3003,3005,3006,3007,3009,3010,3011,3012",
                "--capabilities=" + capabilities + "," + capabilities,
                "--nice-name=system_server",
                "--runtime-args",
                "--target-sdk-version=" + VMRuntime.SDK_VERSION_CUR_DEVELOPMENT,
                "com.android.server.SystemServer",
        };
        ZygoteArguments parsedArgs;

        int pid;
        try {
            ...
            // fork出system_server进程
            pid = Zygote.forkSystemServer(
                    parsedArgs.mUid, parsedArgs.mGid,
                    parsedArgs.mGids,
                    parsedArgs.mRuntimeFlags,
                    null,
                    parsedArgs.mPermittedCapabilities,
                    parsedArgs.mEffectiveCapabilities);
        } catch (IllegalArgumentException ex) {
            throw new RuntimeException(ex);
        }

        /* For child process */
        if (pid == 0) {
            // 子线程，也就是system_server进程
            return handleSystemServerProcess(parsedArgs);
        }
        // 主线程，也就是zygote进程
        return null;
    }
```

最终`fork`出了一个进程，并指定`uid`和`gid`均是1000，名称为`system_server`，这里实际是走到`native`层去`fork`的，具体细节就不再看了。对于`zygote`进程返回了个null，而对于`system_server`进程则返回这个`Runnable`然后并执行之后就结束了。

```java
// frameworks/base/core/java/com/android/internal/os/ZygoteInit.java

private static Runnable handleSystemServerProcess(ZygoteArguments parsedArgs) {
        ...
        if (parsedArgs.mInvokeWith != null) {
            ...
        } else {
            ClassLoader cl = getOrCreateSystemServerClassLoader();
            if (cl != null) {
                Thread.currentThread().setContextClassLoader(cl);
            }

            ...
            // 这里最终返回的Runnable就是找到的SystemServer的main方法
            return ZygoteInit.zygoteInit(parsedArgs.mTargetSdkVersion,
                    parsedArgs.mDisabledCompatChanges,
                    parsedArgs.mRemainingArgs, cl);
        }
}
```

这里我们不再继续查看了，最终对于`system_server`进程返回的`Runnable`就是参数中传递的`com.android.server.SystemServer`其类的主函数。因此回到前面，我们知道在`zygote`进程`fork`出`system_server`后，新的进程就会执行`SystemServer#main`方法然后就结束了。然后`zygote`其本身则是进入了循环等到消息，等消息来了会执行各种操作，尤其是创建子进程的消息，如果创建了子进程，则会在子进程中返回`Caller`，然后执行`run`后结束。而父进程`zygote`则还是在`runSelectLoop`中进行循环等待。

```java
// frameworks/base/core/java/com/android/internal/os/ZygoteServer.java

   Runnable runSelectLoop(String abiList) {
        ...
        // 死循环，后续会一直在这里通过poll机制等待消息
        while (true) {
            ...
            int pollReturnValue;
            try {
                // 进入poll阻塞并监听zygote的socket消息，然后等待被唤醒
                pollReturnValue = Os.poll(pollFDs, pollTimeoutMs);
            } catch (ErrnoException ex) {
                throw new RuntimeException("poll failed", ex);
            }
            if (pollReturnValue == 0) {
               ...
            } else {
                boolean usapPoolFDRead = false;

                while (--pollIndex >= 0) {
                    ...
                    if (pollIndex == 0) {
                        ...
                    } else if (pollIndex < usapPoolEventFDIndex) {
                        try {
                            ZygoteConnection connection = peers.get(pollIndex);
                            // 接收socket的消息，然后根据指令执行各种方法，其中最重要就是会fork子进程
                            final Runnable command =
                                    connection.processCommand(this, multipleForksOK);
                            // 在fork完之后会立即设置这个标记
                            if (mIsForkChild) {
                                // 返回子进程的Runnable，通常是main方法
                                return command;
                            } else {
                                ...
                            }
                        } catch (Exception e) {
                            ...
                        } finally {
                            mIsForkChild = false;
                        }

                    } else {
                        ...
                    }
                }
                ...
            }
            ...
        }
    }
```

到这里，`zygote`的流程基本上就走完了，进程会一直阻塞在`runSelectLoop`等待消息，而它创建的子进程则会返回出来，然后执行子进程返回的`Runnable`消息。

从`native`到`java`层，`zygote`确如其名，作为一个孵化进程存在。它预加载了各种属性以及类库，然后`fork`出一个`system_server`进程，然后进入循环阻塞状态等待`socket`的消息。通常情况下，我们启动一个`app`最终都是走到`zygote`中然后由其`fork`出来进程并执行其`main`方法。
