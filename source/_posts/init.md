---
title: Android Init进程
date: 2022-06-03 21:18:26
categories: Android Framework
tags:
 - AOSP
banner_img: img/cover/cover-init.webp
---

在`Android`系统启动时，会创建两个进程`init`和`kthreadd`。它们是后续所有进程的祖先，其中`init`进程主要负责完成系统的初始化工作，挂载文件、创建目录、配置信息等，它管理和创建用户空间层的所有进程，进程号为1。而`kthreadd`进程是对内核进程的管理，所有内核进程都是由`kthreadd`直接或间接创建的，它负责管理内核的生命周期等，进程号为2。

可以通过`adb shell ps -ef`查看进程信息。

```cmd
PS C:\Users\feng\Desktop> adb shell ps -ef
UID        PID  PPID C STIME TTY          TIME CMD
root         1     0 0 06:36:23 ?     00:00:06 init second_stage
root         2     0 0 06:36:23 ?     00:00:00 [kthreadd]
```

## Init进程

> 本文基于Android13源码

`init`进程是在内核启动时，由内核中`kernal_init`方法通过`try_init_process`启动的。实际上它的代码主入口在`system/core/init/main.cpp`中。

```c++
int main(int argc, char** argv) {
    // 文件名为ueventd时，执行该逻辑
    if (!strcmp(basename(argv[0]), "ueventd")) {
        return ueventd_main(argc, argv);
    }

    if (argc > 1) {
        if (!strcmp(argv[1], "subcontext")) {
            android::base::InitLogging(argv, &android::base::KernelLogger);
            const BuiltinFunctionMap& function_map = GetBuiltinFunctionMap();

            return SubcontextMain(argc, argv, &function_map);
        }

        if (!strcmp(argv[1], "selinux_setup")) {
            return SetupSelinux(argv);
        }

        if (!strcmp(argv[1], "second_stage")) {
            return SecondStageMain(argc, argv);
        }
    }

    return FirstStageMain(argc, argv);
}
```

### ueventd

在主入口中，分为多个逻辑，其中当`argv[0]`为`ueventd`时，即可执行文件的名字为`ueventd`时，会通过`ueventd_main`方法启动`ueventd`服务，它主要是负责挂载和创建设备节点的。由内核启动时，执行的是`/init`，因此不会走到这里，它实际上被定义在`rc`文件中启动的，`system/core/rootdir/init.rc`。

```rc
service ueventd /system/bin/ueventd
    class core
    critical
    seclabel u:r:ueventd:s0
    shutdown critical
```

`ueventd`服务是通过`rc`文件启动的，因此它实际上的执行顺序会比较靠后，因为在`init`的第二阶段才会去解析`rc`文件。可以查看它的可执行文件，只是一个软链接，实际上仍指向`init`可执行文件，因此才会有上面的逻辑。

```
PS C:\Users\feng\Desktop> adb shell ls -l /system/bin/ueventd
lrwxr-xr-x 1 root shell 4 2022-06-03 22:32 /system/bin/ueventd -> init
```

### first_stage

再由内核启动`init`的时候，实际上参数都不会匹配上述的判断逻辑，因此在首次执行`init`的时候，走的是第一阶段`FirstStageMain`。

```c++
// system/core/init/first_stage_init.cpp

int FirstStageMain(int argc, char** argv) {
    ...
    CHECKCALL(clearenv());
    CHECKCALL(setenv("PATH", _PATH_DEFPATH, 1));
    CHECKCALL(mount("tmpfs", "/dev", "tmpfs", MS_NOSUID, "mode=0755"));
    CHECKCALL(mkdir("/dev/pts", 0755));
    CHECKCALL(mkdir("/dev/socket", 0755));
    CHECKCALL(mkdir("/dev/dm-user", 0755));
    CHECKCALL(mount("devpts", "/dev/pts", "devpts", 0, NULL));
    CHECKCALL(mount("proc", "/proc", "proc", 0, "hidepid=2,gid=" MAKE_STR(AID_READPROC)));
    ...

    // 再次执行init程序，这次传的参数中有一个selinux_setup参数
    const char* path = "/system/bin/init";
    const char* args[] = {path, "selinux_setup", nullptr};
    ...
    execv(path, const_cast<char**>(args));
    return 1;
}
```

第一阶段的启动，主要是负责挂载各个目录，以及创建对应的文件可目录等，然后就是初始化内核日志等操作。当第一阶段的逻辑执行完成后，会再次执行`init`，并且传入`selinux_setup`参数，因此后续会进入到`SetupSelinux`中。

### selinux_setup

第一阶段创建和挂载目录之后，就会进入下一阶段，该阶段就是`SELinux`的配置阶段。

```c++
//system/core/init/selinux.cpp

int SetupSelinux(char** argv) {
    SetStdioToDevNull(argv);
    InitKernelLogging(argv);
    MountMissingSystemPartitions();
    SelinuxSetupKernelLogging();
    PrepareApexSepolicy();
    ReadPolicy(&policy);
    CleanupApexSepolicy();
    auto snapuserd_helper = SnapuserdSelinuxHelper::CreateIfNeeded();
    LoadSelinuxPolicy(policy);
    SelinuxSetEnforcement();
    setenv(kEnvSelinuxStartedAt, std::to_string(start_time.time_since_epoch().count()).c_str(), 1);

    // 再次执行init，并且传递了second_stage参数
    const char* path = "/system/bin/init";
    const char* args[] = {path, "second_stage", nullptr};
    execv(path, const_cast<char**>(args));
    return 1;
}

```

这里我们也不用过多深究，它主要就是负责加载`SELinux`的策划信息等，当所有逻辑执行结束后，会再次执行`init`来进入到下一阶段`SecondStageMain`。

### second_stage

第二阶段可以说是`init`进程的最后一个阶段了，它会解析`rc`文件并创建对应的服务进程，并且会一直存在于系统中。

```c++
int SecondStageMain(int argc, char** argv) {
    // 设置oom_score_adj，该属性用于控制当内存不足时被杀死的优先级
    if (auto result =
                WriteFile("/proc/1/oom_score_adj", StringPrintf("%d", DEFAULT_OOM_SCORE_ADJUST));
        !result.ok()) {
        LOG(ERROR) << "Unable to write " << DEFAULT_OOM_SCORE_ADJUST
                   << " to /proc/1/oom_score_adj: " << result.error();
    }
    // 初始化属性服务
    PropertyInit();

    // 注册epoll监听
    Epoll epoll;
    InstallSignalFdHandler(&epoll);
    InstallInitNotifier(&epoll);
    StartPropertyService(&property_fd);

    // 创建AM和SM解析器，然后加载并解析rc文件
    ActionManager& am = ActionManager::GetInstance();
    ServiceList& sm = ServiceList::GetInstance();
    LoadBootScripts(am, sm);
    // 发送对应的触发器，以根据rc文件的配置来启动对应的服务
    am.QueueEventTrigger("early-init");
    am.QueueEventTrigger("init");
    std::string bootmode = GetProperty("ro.bootmode", "");
    if (bootmode == "charger") {
        am.QueueEventTrigger("charger");
    } else {
        am.QueueEventTrigger("late-init");
    }
    while (true) {
        // 进入epoll阻塞
        auto pending_functions = epoll.Wait(epoll_timeout);
        ...
    }

    return 0;
}
```

我们重点关注第二阶段的初始化，因为这一阶段才算的上是Android的启动。

#### 初始化属性服务

在第二阶段会初始化属性服务，也就是系统属性。它可以包含系统属性也可以用于应用设置属性，有点类似于系统环境变量，很多配置都是通过属性服务来设置的。在第二阶段的初始化中，会通过`PropertyInit`方法进入初始化。

```c++
// system/core/init/property_service.cpp

void PropertyInit() {
    selinux_callback cb;
    cb.func_audit = PropertyAuditCallback;
    selinux_set_callback(SELINUX_CB_AUDIT, cb);

    // 创建属性服务的目录，对应是属性文件会在该目录下
    mkdir("/dev/__properties__", S_IRWXU | S_IXGRP | S_IXOTH);
    CreateSerializedPropertyInfo();
    if (__system_property_area_init()) {
        LOG(FATAL) << "Failed to initialize property area";
    }
    // 加载默认的配置/dev/__properties__/property_info
    if (!property_info_area.LoadDefaultPath()) {
        LOG(FATAL) << "Failed to load serialized property info file";
    }

    // 读取/proc/bootconfig中的androidboot.android_dt_dir或androidboot.android_dt_dir
    ProcessKernelDt();
    // 读取/proc/cmdline
    ProcessKernelCmdline();
    // 读取/proc/bootconfig
    ProcessBootconfig();

    // 处理内核boot相关的属性，ro.boot开头的属性
    ExportKernelBootProps();
    // 加载各个路径下的build.proc和default.proc文件
    PropertyLoadBootDefaults();
}
```

#### 注册epoll监听

`epoll`机制是`Linux`中用来监听文件变化的一个机制，他可以在文件不可读时阻塞并释放`cpu`，然后在文件可读时唤醒，具体可以查看[Handler唤起的基础--eventfd和epoll](https://pgaofeng.github.io/2022/02/23/eventfd-epoll/)。

##### InstallSignalFdHandler

该方法主要就是注册信号量的`epoll`，因为`init`是所有用户进程的祖先进程，因此需要注册信号量来接收子孙进程发送的信号，来处理相关的回收等逻辑。

```c++
// system/core/init/init.cpp

static void InstallSignalFdHandler(Epoll* epoll) {
    ...
    // 创建一个信号量文件描述符
    signal_fd = signalfd(-1, &mask, SFD_CLOEXEC | SFD_NONBLOCK);
    constexpr int flags = EPOLLIN | EPOLLPRI;
    auto handler = std::bind(HandleSignalFd, false);
    // 向epoll中注册该信号量，当收到信号量时，会唤醒epoll，然后交给handler中的HandleSignalFd方法处理
    if (auto result = epoll->RegisterHandler(signal_fd, handler, flags); !result.ok()) {
        LOG(FATAL) << result.error();
    }
}
```

##### InstallInitNotifier

该方法注册了一个`eventfd`，该文件描述符用于唤醒`init`进程，因为在系统启动后，`init`进程是一直常驻的，但肯定不会是一直活跃的，因此会通过`epoll`机制进行阻塞，如果想要唤醒`init`进程，只需要通过`wake_main_thread_fd`描述符写入内容即可唤醒。

```c++
static int wake_main_thread_fd = -1;
static void InstallInitNotifier(Epoll* epoll) {
    // 创建一个eventfd
    wake_main_thread_fd = eventfd(0, EFD_CLOEXEC);
    if (wake_main_thread_fd == -1) {
        PLOG(FATAL) << "Failed to create eventfd for waking init";
    }
    auto clear_eventfd = [] {
        uint64_t counter;
        TEMP_FAILURE_RETRY(read(wake_main_thread_fd, &counter, sizeof(counter)));
    };
    if (auto result = epoll->RegisterHandler(wake_main_thread_fd, clear_eventfd); !result.ok()) {
        LOG(FATAL) << result.error();
    }
}
```

##### StartPropertyService

为系统属性创建一个`socket`，当设置系统属性时，实际上就是通过该`socket`来处理并写入到对应的文件中。这样做是因为有些系统功能是需要一直监听系统属性的，当系统属性变化时会做出响应，通过`ctl.`开头的属性是会被直接响应的，如：`SetProperty("ctl.start", "logd")`实际上会直接通过`start`命令启动`logd`服务。

```c++
// system/core/init/property_service.cpp

void StartPropertyService(int*                                                                                           ) {
    // 创建一个socket
    if (auto result = CreateSocket(PROP_SERVICE_NAME, SOCK_STREAM | SOCK_CLOEXEC | SOCK_NONBLOCK,
                                   /*passcred=*/false, /*should_listen=*/false, 0666, /*uid=*/0,
                                   /*gid=*/0, /*socketcon=*/{});
        result.ok()) {
        property_set_fd = *result;
    } else {
        LOG(FATAL) << "start_property_service socket creation failed: " << result.error();
    }
    // 监听该socket
    listen(property_set_fd, 8);
    // 启动一个新的线程，该线程会执行PropertyServiceThread方法
    auto new_thread = std::thread{PropertyServiceThread};
    property_service_thread.swap(new_thread);
}

static void PropertyServiceThread() {
    // 为该线程创建一个新的epoll
    Epoll epoll;
    // 然后将socketfd注册到epoll中，当唤醒时，会通过handle_property_set_fd方法去处理相关逻辑
    if (auto result = epoll.RegisterHandler(property_set_fd, handle_property_set_fd);
        !result.ok()) {
        LOG(FATAL) << result.error();
    }
    // 还注册了一个init_socket，该fd唤醒对应的是HandleInitSocket方法
    if (auto result = epoll.RegisterHandler(init_socket, HandleInitSocket); !result.ok()) {
        LOG(FATAL) << result.error();
    }
    // 通过epoll.wait进入阻塞等待被唤醒
    while (true) {
        auto pending_functions = epoll.Wait(std::nullopt);
        ...
    }
}
```

#### 解析rc文件

这部分是解析`rc`文件的，基本上所有的系统服务都是通过`rc`文件来定义的，然后在系统启动时会由`init`进程解析并启动。它主要的逻辑就是加载`rc`文件，然后通过触发器来决定是否启动对应的服务等。具体的`rc`文件规则，可以查看[Android Init Language](https://pgaofeng.github.io/2022/05/13/android-lint-language/)。

```c++
// system/core/init/init.cpp

static void LoadBootScripts(ActionManager& action_manager, ServiceList& service_list) {
    Parser parser = CreateParser(action_manager, service_list);
    // 如果系统属性中没有ro.boot.init_rc的话，就会从下面的路径加载对应的rc文件
    std::string bootscript = GetProperty("ro.boot.init_rc", "");
    if (bootscript.empty()) {
        parser.ParseConfig("/system/etc/init/hw/init.rc");
        if (!parser.ParseConfig("/system/etc/init")) {
            late_import_paths.emplace_back("/system/etc/init");
        }
        parser.ParseConfig("/system_ext/etc/init");
        if (!parser.ParseConfig("/vendor/etc/init")) {
            late_import_paths.emplace_back("/vendor/etc/init");
        }
        if (!parser.ParseConfig("/odm/etc/init")) {
            late_import_paths.emplace_back("/odm/etc/init");
        }
        if (!parser.ParseConfig("/product/etc/init")) {
            late_import_paths.emplace_back("/product/etc/init");
        }
    } else {
        parser.ParseConfig(bootscript);
    }
}

// 创建对应的解析器
Parser CreateParser(ActionManager& action_manager, ServiceList& service_list) {
    Parser parser;

    parser.AddSectionParser("service", std::make_unique<ServiceParser>(
                                               &service_list, GetSubcontext(), std::nullopt));
    parser.AddSectionParser("on", std::make_unique<ActionParser>(&action_manager, GetSubcontext()));
    parser.AddSectionParser("import", std::make_unique<ImportParser>(&parser));

    return parser;
}
```

### 总结

到这里`init`进程就分析完了，过程比较简陋，只关注了主要的逻辑。首先`init`进程分为三个阶段：第一阶段，`SELinux`阶段，第二阶段。其中第一阶段挂载和创建对应的目录，`SELinux`阶段用于初始化`SELinux`，第二阶段初始化系统属性已经加载`rc`文件并启动对应的系统服务。























