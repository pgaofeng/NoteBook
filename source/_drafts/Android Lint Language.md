---
title: 【翻译】Android Init Language
date: 2022-05-13 19:45:27
categories: Android Framework
tags:
 - AOSP
banner_img: img/cover/android-init.webp
---

## Android Init Language

> 在Android系统启动的时候，会进行一系列的初始化操作，这些操作通常都是有rc文件来声明的。而rc文件中描述的规则就是本文所讲的Android Init Language。
>
> 原文链接： AOSP/system/core/init/README.md

`Android` 初始化语言由五大类的语句组成：`Actions`，`Commands`，`Services`，`Options`，`Imports`。

所有的这些分类都是以行为单位的，中间使用空格进行分割。可以使用C语言样式的反斜杠转义符来在命令里插入空格，也可以使用双引号来避免文本被分割成多个指令。当反斜杠在行尾的时候，可以实现命令的换行。

以`#`开头的行是注释内容（`#`前面允许有空格）。

系统属性可以用`${property.name}`的形式使用，这也适合在需要串联多个文件的场景中使用，如：`import /init.recovery.${ro.hardware}.rc`

`Actions`和`Services`都会默认生成一个上下文，所有的`Commands`和`Options`都属于它最近的上下文。在第一个上下文的前面声明的`Commands`和`Options`都会被忽略掉。

`Sercices`具有唯一的名字，如果另一个`Service`定义时名字已经被定义过了，则该`Service`会被忽略掉并记录在log中。

### init.rc文件

`Android Init` 语言被用在以`rc`为后缀的文本文件中，在系统中有多个地方用到了这些文件，如下所述：

`/system/etc/init/hw/init.rc`是主要的`.rc`文件，他在`init`进程执行的最开始的位置被加载，负责系统的初始化设置。

`init`进程在加载完`system/etc/init/hw/init.rc`之后立即加载`{system, system_ext, vendor, odm, product}/etc/init/`目录下的所有`rc`文件。在后面的`Imports`章节中会具体解释这些。

没有第一阶段挂载机制的旧设备可以在`mount_all`的时候导入`init`脚本，然而这种方式已经被废弃了，并且在`Android Q`之后不再支持。

这些路径的作用：

1. `/system/etc/init/`用来初始化核心系统项，如`SurfaceFlinger`、`MediaService`、`logd`等。
2. `/vendor/etc/init/`用来初始化`SoC`供应商的服务项，如核心`Soc`功能所需的操作或者守护进程等。
3. `odm/etc/init`用来初始化设备制造商的项目，如运动传感器或其他外围功能所需的操作或者守护进程等。

在`system`、`vendor`或者`odm`分区上的所有的二进制服务，都应该有对应的声明在`rc`文件中的服务入口，这些`rc`文件应该位于他们所在分区的`/etc/init/`目录下。编译系统的时候会有一个宏`LOCAL_INIT_RC`，来帮助开发者处理这些`rc`文件。每个用来初始化的`rc`文件都应该包含与他的服务相关联的所有的操作。

例如，`logcatd.rc`和`Android.mk`文件位于`system/core/locat`目录中。在`userdebug`模式下编译系统时，在`Android.mk`中的`LOCAL_INIT_RC`宏就会将`logcatd.rc`文件放在`/system/etc/init`中。在`mount_all`命令阶段`Init`进程会加载`logcatd.rc`，并且在适当的时机将服务的操作加入到队列中运行。

根据服务的守护进程来将`init.rc`文件进行区分比以前使用一个完整的`init.rc`更好一些，这种方式确保了`init`进程通过该文件读取到唯一的服务入口和操作，并对应于其实际的二进制文件，而单个`init.rc`则不是这样的。并且当多个服务被添加到系统中时，这种方式更有助于解决合并冲突，因为每个服务都是在一个单独的文件中的。

### APEX的版本化RC文件

从`Android Q`的主线代码开始，每个主线模块都有自己的`init.rc`文件，`init`进程按照`/apex/*/etc/*rc`的命名模式来处理这些文件。

因为`APEX`模块必须可以在多个`Android`版本上运行，因此他们在服务的定义上必须是不同的参数。从`Android T`开始，通过将`SDK`版本信息合并到`init`文件的名称中来实现这点。文件的后缀名从`.rc`变成`.#rc`，其中`#`是该`RC`文件支持的最低`SDK`版本。如一个指定`SDK=31`的`rc`文件其命名可能是`init.31rc`。通过这种方式，`APEX`可以包含多个`init`文件，如下示例。

对于一个`APEX`模块，在`/apex/sample-module/apex/etc/`目录下会有如下文件：

1. `init.rc`
2. `init.32rc`
3. `init.35rc`

选择的规则就是选取不超过当前SDK版本的最大的`.#rc`文件。为使用数字修饰的`.rc`会被认为是`SDK=0`。

当这个`APEX`模块被安装在`SDK<=31`的设备上时，系统会处理`init.rc`文件；当被安装在SDK 32，33，34的设备上时，系统会处理`init.32rc`；当`SDK>=35`时，会选择`init.35rc`。

这种版本规则进用于`APEX`模块的`init`文件，它不适用于存储在`/system/etc/init`、`/vendor/etc/init`或者其他目录下的`init`文件。该规则从`Android S`开始使用。

### Actions

`Actions`是指一系列被命名的命令操作。`Actions`会有一个触发器用来决定何时执行该命令，当发生与该`Action`的触发器匹配的事件时，该`Action`就会被加入到待执行队列的尾部（除非它已经在队列中了）。

队列中的`Action`逐个出列，每个`Action`的命令也是按顺序执行。`init`进程会在这些活动中的命令执行之间处理其他活动（如设备的创建\销毁、属性设置、进程重启等）。

`Actions`使用以下形式声明：

```
on <trigger> [&& <trigger>]*
    <command>
    <command>
    <command>
```

`Actions`会被添加到队列中，并根据包含他们的文件被解析的顺序执行(参阅`import`部分)，然后在单独的文件中按顺序执行。

例如某个文件的内容如下：

```
on boot
   setprop a 1
   setprop b 2

on boot && property:true=true
   setprop c 1
   setprop d 2

on boot
   setprop e 1
   setprop f 2
```

然后当启动的事件`boot`被触发时，并且属性`true`的值为`true`，则执行命令的顺序为：

```
setprop a 1
setprop b 2
setprop c 1
setprop d 2
setprop e 1
setprop f 2
```

### Services

`Services`是一种在初始化启动并在退出时重启(可选的)的程序，它用以下形式进行声明“

```
service <name> <pathname> [ <argument> ]*
   <option>
   <option>
   ...
```

### Options

`Options`是`Services`的修饰符，他们影响着服务如何运行以及何时运行。

````
capabilities [ <capability>\* ]
````

当执行该服务时可以设置`capability`。`capability`应该是一个不带`CAP_`前缀的`Linux capability`，如`NET_ADMIN`或`SETPCAP`。可以通过链接[http://man7.org/linux/man-pages/man7/capabilities.7.html](http://man7.org/linux/man-pages/man7/capabilities.7.html)查看`Linux`的`capability`列表。如果没有提供`capability`，那么该服务会被删除掉所有的`capability`，即便该服务以`root`身份运行。

```
class <name> [ <name>\* ]
```

为`Services`设置类名，在同一个类名下的所有的服务可以一起启动或者停止，如果没有指定类名，会指定为默认的类名`default`。第一个类名(必须的)之外的其他类名用来将服务分组，如`animation`类应该包含启动动画和关机动画所需的所有服务。由于这些服务可以在引导过程中很早的就启动，并且可以运行到关机的最后的阶段，因此无法保障他们对`/data`分区的访问。这些服务可以检查`/data`分区下的文件，但是不应该一直打开着这些文件，此外他们还应该在`/data`不可用时也能运行。

```
console [<console>]
```

服务可能需要一些控制台命令，第二个参数(可选的)可以选择一个指定的控制台而不是使用默认控制台。默认的控制台`/dev/console`可以通过设置`androidboot.console`内核参数来修改。在所有的情况下前缀`/dev/`都可以被省略，因此`/dev/tty0`可以被执行为`console tty0`，这个操作可以标准输入输出`stdin`、`stdout`、`stderr`连接到这个控制台中。它与`stdio_to_kmsg`命令互斥，其中后者只能重定向`stdout`和`stderr`。

```
critical [window=<fatal crash window mins>] [target=<fatal reboot target>]
```

这是一个设备关键型的服务。如果他在致命崩溃的`mins`分钟内或者在完成启动前退出超过4次，该设备就会重启到`fatal reboot`目标。其中默认的致命崩溃`mins`值为4，默认的`fatal reboot`目标是`bootloader`。针对测试来说，可以通过设置属性`init.svc_debug.no_fatal.<service-name>`的值为`true`来跳过`fatal reboot`。

```
disable
```

该服务不会跟随它的类名服务一起自动启动，它必须明确的指定名称或者接口名称来启动。

```
enter_namespace <type> <path>
```

可以进入位于`path`路径下的`type`命名空间。仅网络服务的命名空间可以被设置`type`为`net`。注意只能进入给定的一个`type`命名空间。

```
file <path> <type>
```

打开一个文件，并将其`fd`传递给启动的进程，其中`type`可以取值为`r`, `w` ,`rw`。对于`native`的可执行文件，请参阅`libcutils`的`android_get_control_file()`。

```
group <groupname> [ <groupname>\* ]
```

在执行该服务前设置分组名称，第一个参数(必须的)后的其他参数被用来设置为子分组(通过`setgroups()`)。默认的分组为`root`（或许默认可以设置为`nobody`）。

```
interface <interface name> <instance name>
```

将该服务于它的`AIDL`或者`HIDL`服务相关联。其中接口名称必须是完整的限定名称而不是一个值名称，例如，这被使用来允许`servicemanager`或`hwservicemanager`来延迟启动服务。当服务有多个接口时，该标签应该多次使用。使用`HIDL`接口的一个实例就是`interface verdor.foo.bar@1.0::Ibaz default`，对于`AIDL`，则使用`interface aidl <instance name>`。其中`AIDL`中的实例名称是在`servicemanager`中注册的服务名字，可以通过`adb shell dumpsys -l`来列出这些实例名称。

```
ioprio <class> <priority>
```

通过系统调用`SYS_ioprio_set`来设置IO优先级和IO优先级类， 类必须是`rt`，`be`，`idle`中的一个。优先级必须是一个0-7的整数。

```
keycodes <keycode> [ <keycode>\* ]
```

设置键盘码用来触发该服务，如果同时按下设置的所有的键盘码，则服务会被启动。典型用法就是用来启动`bugreport`服务。

这些参数也可以设置为一个属性值而不是一系列的键盘码，这种情况下，只能设置一个选项：属性名需要是典型的属性展开格式。这个属性必须包含用逗号分隔的键盘码列表，或者使用文本`none`表示此服务不响应键盘码。

例如：`keycodes ${some.property.name:-none}`，其中`some.property.name`表示的是“123,124,125”。由于键盘码在init进程中很早就被处理了，因此只有`PRODUCT_DEFAULT_PROPERTY_OVERRIDES`属性才能使用。

```
memcg.limit_in_bytes <value> and memcg.limit_percent <value>
```

将`child`的`memory.limit_in_bytes`设置为最小为`limit_in_bytes`bytes大小，以及物理内存大小的百分比`limit_percent`（仅当挂载`memcg`的时候）。值必须大于等于0。

```
memcg.limit_property <value>
```

将`child`的`memory.limit_in_bytes`设置为指定的属性的值（仅当挂载`memcg`的时候）。这个属性会覆盖`memcg.limit_in_bytes`和`memcg.limit_percent`。

```
memcg.soft_limit_in_bytes <value>
```

将`child`的`memory.soft_limit_in_bytes`设置为指定的值（仅当挂载`memcg`的时候）。值必须大于等于0。

```
memcg.swappiness <value>
```

将`child`的`memory.swappiness`设置为指定的值（仅当挂载`memcg`的时候）。值必须大于等于0。

```
namespace <pid|mnt>
```

当`fork`这个服务的时候设置一个新的`pid`或者挂载的命名空间。

```
oneshot
```

当服务退出时，不再重启该服务。

```
onrestart
```

当服务重启时，执行命令（见下文）。

```
oom_score_adjust <value>
```

设置`child`的` /proc/self/oom_score_adj `为指定的值，取值范围为-1000 到 1000。

```
override
```

这个服务的定义会覆盖掉别的具有相同名字的服务的定义，这通常意味着在`/odm`上定义的服务会覆盖掉`/vendor`上定义的服务，`init`进程会用该服务的最后一个服务的定义来处理这个服务。需要密切注意`init.rc`文件的解析顺序，因为他有一些特殊的向后兼容性内容。`import`章节会更加具体的解释这些。

```
priority <priority>
```

为这个服务进程设置优先级，取值范围为-20到19，默认值为0，优先级通过`setpriority()`设置。

```
reboot_on_failure <target>
```

如果该进程无法被启动，或者服务进程终止时退出码不是`CLD_EXITED`，状态值不是0，重启系统到指定的`target`目标，其中`target`参数和`sys.powerctl`具有相同的格式。这通常适合和`exec_start`内置程序一起使用，用于在启动期间做一些必备检查。

``` 
restart_peroid <seconds>
```

如果一个服务是非`onshot`的，那么当它退出时会在轮到它的再次启动的时候往后推迟这个值之后再重新启动，默认值是5秒以避免频繁崩溃。对于需要定期执行的服务可以设置这个值，如：设置为3600表示该服务每小时执行一次，设置为86400表示该服务每天执行一次。

```
rlimit <resource> <cur> <max>
```

将进程资源的限制应用到当前的`Service`上。`rlimit`是可以被子进程继承的，因此可以有效的将`rlimit`作用于当前`Service`的进程树上，它和`setrlimit`命令的作用是类似的。

```
seclabel <seclabel>
```

在执行该服务前设置`seclabel`。主要用于从`rootfs`运行的服务，如`ueventd`，`adbd`等。`system`分区上的服务可以使用基于问他们的文件安全上下文的定义的策略转换。如果没有指定并且在策略中也没有定义转换，则默认使用`init`进程的上下文。

```
setenv <name> <value>
```

在启动的进程中设置环境变量属性。

```
shutdown <shutdown_behavior>
```

为该服务进程设置关闭行为。如果为指定该参数，则在关机时使用`SIGTERM`和`SIGKILL`来终止该服务。如果该参数设置为`critical`，则关机时不会终止该服务，直到超时。当关机超时的时候，即使服务被设置为`critical`也一样会被杀死。当设置为`sritical`的服务在关机时如果没有在运行，则此时也会被启动。

```
sigstop
```

在执行该服务前发送`SIGSTOP`信号，这通常用于调试，在下面的关于调试的章节中会说明该如何使用。

```
socket <name> <type> <perm> [ <user> [ <group> [ <seclabel> ] ] ]
```

创建一个名为`/dev/socket/name`的套接字，并将其`fd`传递给启动的进程，该套接字会在启动服务的时候同步启动。参数`type`必须为`dgram`、`stream`或`seqpacket`，其也可以以`+passcred`结尾来启动套接字的`SO_PASSCRD`，或者以`+listen`结尾使其成为一个监听的套接字。`user`和`group`默认是0，`seclabel`是该套接字的`SELinux`策略上下文，可以通过seclabel明确指定或者根据服务的可执行文件的安全上下文来计算得出。对于`native`可执行文件可以参考`libcutils`中的`android_get_control_socket()`。

```
stdio_to_kmsg
```

将`stdout`和`stderr`重定向到`/dev/kmsg_debug`中。这对于在很早启动的、并且不使用Android原生日志的、并且我们还想要获取这些日志记录的服务而言是非常有用的。它只有在`/dev/kmsg_debug`启用时才会启用，而且仅在`userdebug`和`eng`版本中启动。这与`console`命令是互斥的，后者还能额外的将`stdin`也重定向过去。

```
task_profiles <profile> [ <profile>\* ]
```

当进程`fork`的时候设置它的任务配置。这是为了取代`writepid`操作来将进程移动到`cgroup`中。

```
timeout_period <seconds>
```

提供服务的一个超时时间，超过该时间后服务会被杀死。这里尊重`oneshot`类型的服务，因为`oneshot`的服务不会被自动重启，而其他的服务会。该属性与前面的`restart_period`结合起来使用更合适。

```
updatable
```

标记该服务可以在后续的启动序列中被APEX服务给覆盖(通过`override`方法)。如果被标记了`updatable`的服务在所有的`APEX`模块激活前就被启动，则该次执行会被推迟，直到所有的`APEX`模块激活后再执行。如果未被标记为`updatable`，则不能被`APEX`覆盖。

```
user <username>
```

在执行该服务前设置用户，当前默认的用户是`root`(或许可以设置为`nobody`)。在`Android M`中，进程应该使用这个选项，即使他们需要`Linux capabilities`。以前想要获取`Linux capabilities`，进程需要以`root`身份运行，再去请求这些`capabilities`，然后降低为所需的uid。现在有一种新机制，通过`fs_config`来允许设备制造商将`Linux capabilities`添加到需要使用的特定的二进制文件中。这种机制在[This mechanism is described on http://source.android.com/devices/tech/config/filesystem.html](This mechanism is described on http://source.android.com/devices/tech/config/filesystem.html)中有详细的描述。使用这种新机制，进程可以使用`user`选项来选择他们想要的`uid`而不必以`root`的身份运行。从`Android Q`开始，进程也可以直接在他们的`.rc`文件中直接请求`capabilities`，查看前面的`capabilities`章节。

```
writepid <file> [ <file>\* ]
```

在`fork`时将子进程的`pid`写入到文件中，适用于`cgroup/cpuset`使用。如果在`/dev/cpuset/`下没有指定文件，但是系统属性`ro.cpuset.default`被设置为一个非空的`cpuset`名称（如`/foreground`），此时pid就会写入到`/dev/cpuset/cpuset_name/tasks`文件中。使用该操作将进程移动到`cgroup`中已经过时了，请使用`task_profile`方式。

### Triggers

`Triggers`是一个字符串，可以用来匹配特定类型的事件，然后触发`Action`的执行。

触发器又可以分为事件触发器和属性触发器。

事件触发器是由`trigger`命令或者`init`进程中的`QueueEventTrigger()`函数触发，他们采用简单的字串形式，如`boot`或`late-init`。

属性触发器是由指定的属性将值设置为给定的新值或者改为任意的新值后触发的，他们采用`property:`的形式。

一个`Action`可以有多个属性触发器，但是只能有一个事件触发器。

例如：`on boot && property:a=b`定义了一个`Action`，他会在`boot`事件发生时，并且属性a的值为b的时候才会执行。

`on property:a=b && property:c=d`定义的`Action`会在以下三种情况执行：

1. 在初始启动时属性a的值为b， 属性c的值为d。
2. 不论在什么时候，当a的值变为b后，并且此时c的值已经是d了。
3. 不论在什么时候，当c的值变为d后，并且此时a的值已经是b了。

### 触发序列

`init`进程在早期启动期间使用以下的触发器序列，他们是在`init.cpp`中定义的内置触发器：

1. `early-init` 序列中的第一位，在配置了`cgroup`后，在`ueventd`的冷启动完成前触发。
2. `init`在冷启动完成后触发
3. `charger`当属性值`ro.bootmode`值为`charger`的时候触发
4. `late-init`当属性`ro.bootmode`的值非`charger`的时候触发，或者`healthd`从充电模式启动的时候触发。

其余的触发器在`init.rc`中配置，并非内置的。默认的序列是在`init.rc`中的`on late-init`下指定的，在`init.rc`内部的`Action`已经被忽略了。

1. `early-fs` 启动`vold`
2. `fs` `vold`已经起来了，挂载未标记为`first-stage`或者延迟挂载的分区
3. `post-fs` 配置一些依赖早期挂载的任何东西
4. `late-fs` 挂载标记为延迟挂载的分区
5. `post-fs-data` 挂载并配置`/data`分区，设置加密。如果在`first-stage`中未能挂载`/metadata`，则在这个阶段再次格式化。
6. `zygote-start` 启动`zygote`
7. `early-boot `在`zygote`启动后
8. `boot` 在`early-boot`的`Action`全部完成之后

### Commands























