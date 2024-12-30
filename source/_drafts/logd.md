---
title: Android logd日志服务
date: 2022-07-25 14:00:26
categories: Android Framework
tags:
 - AOSP
banner_img: img/cover/cover-logd.webp
---

`Android`日志服务是我们接触非常多的一个服务，主要用于调试以及分析`bug`使用，可以记录程序执行的步骤，方便我们对代码进行追踪。它也是通过`rc`文件描述的，由`init`进程解析并启动的，我们知道`init`的`second_stage`阶段解析`rc`文件，其中会按顺序触发三个触发器以触发各个服务的启动，分别是`early_init`、`init`、`late_init`，日志服务在`init`触发器中启动的服务，它是比`ServiceManager`早启动的，因此是无法使用`binder`的。

> 本文基于Android13源码

## Logd

```
# system/logging/logd/logd.rc

service logd /system/bin/logd
    socket logd stream 0666 logd logd
    socket logdr seqpacket 0666 logd logd
    socket logdw dgram+passcred 0222 logd logd
    file /proc/kmsg r
    file /dev/kmsg w
    user logd
    group logd system package_info readproc
    capabilities SYSLOG AUDIT_CONTROL
    priority 10
    task_profiles ServiceCapacityLow
    onrestart setprop logd.ready false
```

`rc`文件中就是基本的启动，首先启动了`logd`服务，然后创建了三个`socket`。因此可以直接回到main方法中去进行查看。这些都是由`init`进程进行解析并执行的，最终通过执行可执行文件`/system/bin/logd`来启动的`logd`服务.

```c++
// system/logging/logd/main.cpp

int main(int argc, char* argv[]) {
    ...
    // 初始化Log
    android::base::InitLogging(
            argv, [](android::base::LogId log_id, android::base::LogSeverity severity,
                     const char* tag, const char* file, unsigned int line, const char* message) {
                if (tag && strcmp(tag, "logd") != 0) {
                    auto prefixed_message = android::base::StringPrintf("%s: %s", tag, message);
                    android::base::KernelLogger(log_id, severity, "logd", file, line,
                                                prefixed_message.c_str());
                } else {
                    android::base::KernelLogger(log_id, severity, "logd", file, line, message);
                }
            });

    ...

    LogTags log_tags;
    PruneList prune_list;

    // 获取系统属性中日志的类型，默认是serialized
    std::string buffer_type = GetProperty("logd.buffer_type", "serialized");

    // Partial (required for chatty) or full logging statistics.
    LogStatistics log_statistics(GetBoolPropertyEngSvelteDefault("logd.statistics"),
                                 buffer_type == "serialized");
 
    LogReaderList reader_list;

    // 根据类型获取不同的日志buffer
    LogBuffer* log_buffer = nullptr;
    if (buffer_type == "chatty") {
        log_buffer = new ChattyLogBuffer(&reader_list, &log_tags, &prune_list, &log_statistics);
    } else if (buffer_type == "serialized") {
        log_buffer = new SerializedLogBuffer(&reader_list, &log_tags, &log_statistics);
    } else if (buffer_type == "simple") {
        log_buffer = new SimpleLogBuffer(&reader_list, &log_tags, &log_statistics);
    } else {
        LOG(FATAL) << "buffer_type must be one of 'chatty', 'serialized', or 'simple'";
    }

    // 监听日志的读取
    LogReader* reader = new LogReader(log_buffer, &reader_list);
    if (reader->startListener()) {
        return EXIT_FAILURE;
    }

    // 监听日志的写入
    LogListener* swl = new LogListener(log_buffer);
    if (!swl->StartListener()) {
        return EXIT_FAILURE;
    }

    // 监听logcat的命令行
    CommandListener* cl = new CommandListener(log_buffer, &log_tags, &prune_list, &log_statistics);
    if (cl->startListener()) {
        return EXIT_FAILURE;
    }

    // 在rc文件中该属性被设置为false，当启动完成后会置为true，表示日志服务的可用
    SetProperty("logd.ready", "true");

    // LogAudit listens on NETLINK_AUDIT socket for selinux
    // initiated log messages. New log entries are added to LogBuffer
    // and LogReader is notified to send updates to connected clients.
    LogAudit* al = nullptr;
    if (auditd) {
        int dmesg_fd = GetBoolProperty("ro.logd.auditd.dmesg", true) ? fdDmesg : -1;
        al = new LogAudit(log_buffer, dmesg_fd, &log_statistics);
    }

    LogKlog* kl = nullptr;
    if (klogd) {
        kl = new LogKlog(log_buffer, fdDmesg, fdPmesg, al != nullptr, &log_statistics);
    }

    readDmesg(al, kl);

    // failure is an option ... messages are in dmesg (required by standard)
    if (kl && kl->startListener()) {
        delete kl;
    }

    if (al && al->startListener()) {
        delete al;
    }

    TrustyLog::create(log_buffer);

    TEMP_FAILURE_RETRY(pause());

    return EXIT_SUCCESS;
}
```

这里一共做了三件事，分别是初始化日志写入、创建日志`buffer`、启动日志`socket`监听。这里分别查看。

### 日志初始化

日志初始化，这里的初始化实际上设置了如何写入日志的过程，当使用方去设置输出日志时，实际上就是通过这里初始化时设置的方法来输出日志的。

```c++
// system/libbase/include/android-base/logging.h

void InitLogging(char* argv[],
                 LogFunction&& logger = INIT_LOGGING_DEFAULT_LOGGER,
                 AbortFunction&& aborter = DefaultAborter);
```

其接收三个参数，后两个参数都有默认值，可以不需要传入，在logd的初始化中，实际上最主要的就是传入第二个参数`logger`，该方法的具体实现是在另一个文件中：

```c++
void InitLogging(char* argv[], LogFunction&& logger, AbortFunction&& aborter) {
  SetLogger(std::forward<LogFunction>(logger));
  SetAborter(std::forward<AbortFunction>(aborter));

  if (gInitialized) {
    return;
  }
  // 标记已初始化过了
  gInitialized = true;

  // 设置默认的tag，这里实际上是/system/bin/logd
  if (argv != nullptr) {
    SetDefaultTag(basename(argv[0]));
  }

  const char* tags = getenv("ANDROID_LOG_TAGS");
  if (tags == nullptr) {
    return;
  }

  std::vector<std::string> specs = Split(tags, " ");
  for (size_t i = 0; i < specs.size(); ++i) {
    // "tag-pattern:[vdiwefs]"
    std::string spec(specs[i]);
    if (spec.size() == 3 && StartsWith(spec, "*:")) {
      switch (spec[2]) {
        case 'v':
          SetMinimumLogSeverity(VERBOSE);
          continue;
        case 'd':
          SetMinimumLogSeverity(DEBUG);
          continue;
        case 'i':
          SetMinimumLogSeverity(INFO);
          continue;
        case 'w':
          SetMinimumLogSeverity(WARNING);
          continue;
        case 'e':
          SetMinimumLogSeverity(ERROR);
          continue;
        case 'f':
          SetMinimumLogSeverity(FATAL_WITHOUT_ABORT);
          continue;
        // liblog will even suppress FATAL if you say 's' for silent, but fatal should
        // never be suppressed.
        case 's':
          SetMinimumLogSeverity(FATAL_WITHOUT_ABORT);
          continue;
      }
    }
    LOG(FATAL) << "unsupported '" << spec << "' in ANDROID_LOG_TAGS (" << tags
               << ")";
  }
}
```

这里最主要的就是`setLogger`设置成新的`logger`，然后就是一些初始化过程，这与`logd`的设计实现是暂时无关的，可以先就到这里。然后看后面的创建日志`buffer`。

### 创建日志buffer

日志`buffer`决定了日志在内存中是如何存储记录的，它分为三种`buffer`，根据系统属性`logd.buffer_type`来决定使用哪种，默认情况下使用`serialized`。

```c++
// system/logging/logd/LogBuffer.h

class LogBuffer {
  public:
    virtual ~LogBuffer() {}
    // 初始化
    virtual void Init() = 0;
    // 写入log
    virtual int Log(log_id_t log_id, log_time realtime, uid_t uid, pid_t pid, pid_t tid,
                    const char* msg, uint16_t len) = 0;

    virtual std::unique_ptr<FlushToState> CreateFlushToState(uint64_t start, LogMask log_mask)
            REQUIRES(logd_lock) = 0;
    virtual bool FlushTo(
            LogWriter* writer, FlushToState& state,
            const std::function<FilterResult(log_id_t log_id, pid_t pid, uint64_t sequence,
                                             log_time realtime)>& filter) REQUIRES(logd_lock) = 0;

    virtual bool Clear(log_id_t id, uid_t uid) = 0;
    virtual size_t GetSize(log_id_t id) = 0;
    virtual bool SetSize(log_id_t id, size_t size) = 0;

    virtual uint64_t sequence() const = 0;
};
```

`LogBuffer`定义了log的一些基本方法，不同的buffer都需要继承自LogBuffer并实现对应的方法。我们从上面的方法中可以看到，基本上每个方法都会有一个`log_id_t`参数，这是日志的分类参数，`Android`将日志按照分类拆分成多种日志，其关键字`log_id_t`。该值是一个枚举值：

```c++
// system/logging/liblog/include/android/log.h
typedef enum log_id {
  LOG_ID_MIN = 0,

  LOG_ID_MAIN = 0,
  LOG_ID_RADIO = 1,
  LOG_ID_EVENTS = 2,
  LOG_ID_SYSTEM = 3,
  LOG_ID_CRASH = 4,
  LOG_ID_STATS = 5,
  LOG_ID_SECURITY = 6,
  LOG_ID_KERNEL = 7,

  LOG_ID_MAX,
  LOG_ID_DEFAULT = 0x7FFFFFFF
} log_id_t;
```

其中就有我们很熟悉的`main`、`event`、`crash`等，其中我们应用中通过`Log.d`、`ALOGD`等打印的日志都是属于`main`分类的，也是最常见的日志。`LogBuffer`就是通过这些分类来将日志进行分类存储的。

#### SimpleLogBuffer

`SimpleLogBuffer`是最基础的`LogBuffer`，几乎不会使用，这里先讲它是因为其他两种`buffer`都是继承自`SimpleLogBuffer`的。其对应的文件：`system/logging/logd/SimpleLogBuffer.cpp`和`system/logging/logd/SimpleLogBuffer.h`。

```c++
int SimpleLogBuffer::Log(log_id_t log_id, log_time realtime, uid_t uid, pid_t pid, pid_t tid,
                         const char* msg, uint16_t len) {
    if (log_id >= LOG_ID_MAX) {
        return -EINVAL;
    }

    if (!ShouldLog(log_id, msg, len)) {
        // Log traffic received to total
        stats_->AddTotal(log_id, len);
        return -EACCES;
    }

    // Slip the time by 1 nsec if the incoming lands on xxxxxx000 ns.
    // This prevents any chance that an outside source can request an
    // exact entry with time specified in ms or us precision.
    if ((realtime.tv_nsec % 1000) == 0) ++realtime.tv_nsec;

    auto lock = std::lock_guard{logd_lock};
    auto sequence = sequence_.fetch_add(1, std::memory_order_relaxed);
    LogInternal(LogBufferElement(log_id, realtime, uid, pid, tid, sequence, msg, len));
    return len;
}

```



