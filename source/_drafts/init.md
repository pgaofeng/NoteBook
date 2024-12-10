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
lrwxr-xr-x 1 root shell 4 2024-07-11 18:32 /system/bin/ueventd -> init
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
    // 为第二节点的init设置SELinux权限信息
    SelinuxSetupKernelLogging();
    SelabelInitialize();
    SelinuxRestoreContext();

    Epoll epoll;
    InstallSignalFdHandler(&epoll);
    InstallInitNotifier(&epoll);
    StartPropertyService(&property_fd);

   
    SetUsbController();
    SetKernelVersion();

   
    InitializeSubcontext();

    // 创建AM和SM解析器，然后加载并解析rc文件
    ActionManager& am = ActionManager::GetInstance();
    ServiceList& sm = ServiceList::GetInstance();
    LoadBootScripts(am, sm);

    

    // Make the GSI status available before scripts start running.
    auto is_running = android::gsi::IsGsiRunning() ? "1" : "0";
    SetProperty(gsi::kGsiBootedProp, is_running);
    auto is_installed = android::gsi::IsGsiInstalled() ? "1" : "0";
    SetProperty(gsi::kGsiInstalledProp, is_installed);

    am.QueueBuiltinAction(SetupCgroupsAction, "SetupCgroups");
    am.QueueBuiltinAction(SetKptrRestrictAction, "SetKptrRestrict");
    am.QueueBuiltinAction(TestPerfEventSelinuxAction, "TestPerfEventSelinux");
    am.QueueBuiltinAction(ConnectEarlyStageSnapuserdAction, "ConnectEarlyStageSnapuserd");
    am.QueueEventTrigger("early-init");

    // Queue an action that waits for coldboot done so we know ueventd has set up all of /dev...
    am.QueueBuiltinAction(wait_for_coldboot_done_action, "wait_for_coldboot_done");
    // ... so that we can start queuing up actions that require stuff from /dev.
    am.QueueBuiltinAction(SetMmapRndBitsAction, "SetMmapRndBits");
    Keychords keychords;
    am.QueueBuiltinAction(
            [&epoll, &keychords](const BuiltinArguments& args) -> Result<void> {
                for (const auto& svc : ServiceList::GetInstance()) {
                    keychords.Register(svc->keycodes());
                }
                keychords.Start(&epoll, HandleKeychord);
                return {};
            },
            "KeychordInit");

    // Trigger all the boot actions to get us started.
    am.QueueEventTrigger("init");

    // Don't mount filesystems or start core system services in charger mode.
    std::string bootmode = GetProperty("ro.bootmode", "");
    if (bootmode == "charger") {
        am.QueueEventTrigger("charger");
    } else {
        am.QueueEventTrigger("late-init");
    }

    // Run all property triggers based on current state of the properties.
    am.QueueBuiltinAction(queue_property_triggers_action, "queue_property_triggers");

    // Restore prio before main loop
    setpriority(PRIO_PROCESS, 0, 0);
    while (true) {
        // By default, sleep until something happens.
        auto epoll_timeout = std::optional<std::chrono::milliseconds>{kDiagnosticTimeout};

        auto shutdown_command = shutdown_state.CheckShutdown();
        if (shutdown_command) {
            LOG(INFO) << "Got shutdown_command '" << *shutdown_command
                      << "' Calling HandlePowerctlMessage()";
            HandlePowerctlMessage(*shutdown_command);
            shutdown_state.set_do_shutdown(false);
        }

        if (!(prop_waiter_state.MightBeWaiting() || Service::is_exec_service_running())) {
            am.ExecuteOneCommand();
        }
        if (!IsShuttingDown()) {
            auto next_process_action_time = HandleProcessActions();

            // If there's a process that needs restarting, wake up in time for that.
            if (next_process_action_time) {
                epoll_timeout = std::chrono::ceil<std::chrono::milliseconds>(
                        *next_process_action_time - boot_clock::now());
                if (*epoll_timeout < 0ms) epoll_timeout = 0ms;
            }
        }

        if (!(prop_waiter_state.MightBeWaiting() || Service::is_exec_service_running())) {
            // If there's more work to do, wake up again immediately.
            if (am.HasMoreCommands()) epoll_timeout = 0ms;
        }

        auto pending_functions = epoll.Wait(epoll_timeout);
        if (!pending_functions.ok()) {
            LOG(ERROR) << pending_functions.error();
        } else if (!pending_functions->empty()) {
            // We always reap children before responding to the other pending functions. This is to
            // prevent a race where other daemons see that a service has exited and ask init to
            // start it again via ctl.start before init has reaped it.
            ReapAnyOutstandingChildren();
            for (const auto& function : *pending_functions) {
                (*function)();
            }
        } else if (Service::is_exec_service_running()) {
            static bool dumped_diagnostics = false;
            std::chrono::duration<double> waited =
                    std::chrono::steady_clock::now() - Service::exec_service_started();
            if (waited >= kDiagnosticTimeout) {
                LOG(ERROR) << "Exec service is hung? Waited " << waited.count()
                           << " without SIGCHLD";
                if (!dumped_diagnostics) {
                    DumpPidFds("exec service opened: ", Service::exec_service_pid());

                    std::string status_file =
                            "/proc/" + std::to_string(Service::exec_service_pid()) + "/status";
                    DumpFile("exec service: ", status_file);
                    dumped_diagnostics = true;

                    LOG(INFO) << "Attempting to handle any stuck SIGCHLDs...";
                    HandleSignalFd(true);
                }
            }
        }
        if (!IsShuttingDown()) {
            HandleControlMessages();
            SetUsbController();
        }
    }

    return 0;
}
```

























