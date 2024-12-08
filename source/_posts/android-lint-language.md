---
title: 【翻译】Android Init Language
date: 2022-05-13 19:45:27
categories: Android Framework
tags:
 - AOSP
banner_img: img/cover/cover-init-language.webp
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

```
bootchart [start|stop]
```

开启或者关闭`bootchart`。这些都存在于默认的`init.rc`文件中，但是仅当`/data/bootchart/enabled`存在时才会启用`bootchart`，否则这些都是无效的。

```
chmod <octal-mode> <path>
```

修改文件的权限。

```
chown <owner> <group> <path>
```

修改文件的属主和属组。

```
class_start <serviceclass>
```

启动某个类下的所有的未启动的服务，有关启动服务的更多消息，参阅start条目。

```
class_stop <serviceclass>
```

停止并停用某个类下的所有的已启动的服务。

```
class_reset <serviceclass>
```

停止某个类下的所有的已启动的服务，但是并不停用，后续可以通过`class_start`重新启动他们。

```
calss_restart [--only-enabled] <serviceclass>
```

重启某个类下的所有的服务，如果指定了`--only-enabled`，那么`disable`的服务都会被跳过。

```
copy <src> <dst>
```

复制文件，类似于`write`，但是对于二进制文件和大文件来说很有用。对于`src`文件，不允许复制符号链接文件、全局可写文件以及组内可写文件；对于`dst`文件，如果文件不存在的话复制过来的文件的模式默认是`0600`。如果`dst`文件已存在，则不会去复制。

```
copy_per_line <src> <dst>
```

逐行复制文件，和`copy`类似，对于`sys`节点很有用，但是不会去处理多行数据的`sys`节点。

```
domainname <name>
```

设置域名。

```
enable <servicename>
```

启用一个`disable`的服务，就像是没有标记为`disable`一样。如果该服务应该正在运行，那么它现在就会直接启动。典型的使用就是`bootloader`在需要时会设置一个变量来启动某个服务，如下：

```
on property:ro.boot.myfancyhardware=1
    enable my_fancy_service_for_my_fancy_hardware
```

```
exec [ <seclabel> [ <user> [ <group>\* ] ] ] -- <command> [ <argument>\* ]
```

使用给定的参数`fork`并执行某个命令。该命令在`--`之后，因此可以提供安全上下文、用户和组信息。注意在该命令执行完毕前，不会去执行别的命令。`seclabel`可以是一个`-`来表示默认情况，在参数`argument`中可以使用属性值。`init`会停止执行命令，直到在`fork`的进程退出后才恢复。

```
exec_background [ <seclabel> [ <user> [ <group>\* ] ] ] -- <command> [ <argument>\* ]
```

使用给定的参数`fork`并执行某个命令。这和前面的`exec`命令类似，区别就是`init`不会停止执行命令，不论`fork`的进程是否退出。

```
exec_start <service>
```

启动一个`Service`并且停止其他命令，直到它返回。这个命令和`exec`类似，但是用的是一个具体的`Service`来代替`exec`的参数。

```
export <name> <value>
```

设置一个全局变量（在这个命令之后启动的所有进程都会继承到这个变量）。

```
hostname <name>
```

设置主机名。

```
ifup <interface>
```

使用某个在线网络接口。

```
insmod [-f] <path> [<options>]
```

安装某个路径下的模块。`-f`：即使当前内核版本与编译模块的内核版本不一致也强制安装。

```
interface_start <name>
interface_restart <name>
interface_stop <name>
```

找到某个接口名的服务，并在其上运行`start`、`restart`、`stop`命令（如果能找到服务）。`name`可以是一个完整限定的`HIDL`名称，这种情况下它的名字为`<interface>/<instance>`；如果是一个`AIDL`服务，则名字为`aidl/<interface>`。例如：`android.hardware.secure_element@1.1::ISecureElement/eSE1`或者`aidl/aidl_lazy_test_1`。

注意，这些命令只作用于服务接口指定的接口，而不是运行时注册的接口。

这些命令的使用示例：

`intercace_start android.hardware.secure_element@1.1::ISecureElement/eSE1`会启动一个`HIDL`服务，该服务提供`android.hardware.secure_element@1.1::ISecureElement/eSE1`和`eSE1`实例。

`interface_start aidl/aidl_lazy_test_1`会启动一个`AIDL`服务，该服务提供`aidl_lazy_test_1`接口。

```
load_exports <path>
```

导入某个路径下的文件中定义的全局变量。文件的每行内容必须是`export <name> <value>`的格式。

```
load_system_props
```

（该操作已启用，没有任何操作）

```
load_persist_props
```

当`/data`被解密时加载持久属性，他已经包含在了默认的`init.rc`中。

```
loglevel <level>
```

设置log等级，从7（所有的log）到0（仅致命log）。这些数字对应内核日志的级别，但是不会影响到内核日志的级别。使用`write`命令项`/proc/sys/kernal/printk`中写入来修改内核级别。在参数中可以使用属性值。

```
mark_post_data
```

用于标记`/data`挂载后的点。

```
mkdir <path> [<mode>] [<owner>] [<group>] [encryption=<action>] [key=<key>]
```

创建一个目录，可以选定模式、属主和属组。如果没有提供这些参数，则默认创建的权限为755，属主和属组都是`root`用户组。如果提供了参数，并且目录已存在，则更新目录的权限等这些信息。

参数`action`可以是以下取值：

1. `None`：不采用加密操作，如果parent有加密，则采用父目录的加密。
2. `Require`：加密目录，如果加密失败，则终止启动进程。
3. `Attemp`：尝试设置一个加密策略，但是失败后会继续执行。
4. `DeleteIfNessary`：如果需要设置加密策略，则递归删除掉目录。

参数`key`可以是以下取值：

1. `ref`：使用系统范围内的`DE key`。
2. `per_boot_ref`：使用每次启动生成的key。

```
mount_all [ <fstab> ] [--<options>]
```

在给定的`fs_mgr-format`的`fstab`上调用`fs_mgr_mount_all`，并带有参数`early`或`late`。如果参数为`--early`，init进程会跳过挂载带有`latemount`标志的分区并触发fs的加密状态事件。如果参数为`--late`，init进程只会挂载带有`latemount`的分区。默认没有设置参数的情况下，`mount_all`会处理所有给定的`fstab`。如果`fstab`参数也没有指定，在运行时按照顺序从`/odm/etc`、`/vendor/etc`、`/`中扫描`fstab.${ro.boot.fstab_suffix}`、`fstab.${ro.hardware}`、`fstab.${ro.hardware.platform}`。

```
mount <type> <device> <dir> [ <flag>\* ] [<options>]
```

尝试将指定设备挂载到指定的目录。`flags`参数包括`ro`、`rw`、`remount`、`noatime`，`options`参数包括`barrier=1`、`noauto_da_alloc`、`discard`，多个参数可以使用逗号隔开，如：`barrier=1,noauto_da_alloc`。

```
perform_apex_config
```

挂载`APEX`后执行任务。例如，为已挂载的APEX创建数据目录，解析配置文件，更新链接器配置。通过将`apexd.status`设置为`ready`可以在`APEX`通知挂载事件后，只执行一次。

```
restart [--only-if-running]
```

停止并重新启动正在运行的服务，如果该服务正处于重新启动中，则不做任何处理，否则会启动该服务。如果设置了`--only-if-running`，则只会重启正在运行的服务。

```
restorecon <path> [ <path>\* ]
```

被`init.rc`创建的文件则不需要，因为init进程会自动正确的进行标记。

```
restorecon_resursive <path> [ <path>\* ]
```

递归的将将给定的文件重新恢复到在`file_context`配置中指定的安全上下文中。

```
rm <path>
```

在给定的路径上调用`unlink(2)`。你可能想使用`exec -- rm ..`来替代（前提是系统分区已经挂载了）。

```
rmdir <path>
```

在给定目录上调用`rmdir(2)`

```
readahead <file|dir> [--fully]
```

在给定的文件或者目录中的文件上调用`readahead(2)`， 通过参数`--fully`读取完整的文件内容。

```
setprop <name> <value>
```

设置系统属性，参数`value`中可以使用系统属性。

```
setrlimit <resource> <cur> <max>
```

为资源设置`rlimit`，这适用于设置`rlimit`之后启动的所有进程，它旨在init的早期设置然后全局应用。参数`resource`最好使用它的文本表示形式(`cpu`、`etio`、`RLIM_CPU`、`RLIM_RATIO`等)。他也可以为指定的资源枚举对应不同的`int`值。参数`cur`和`max`设置设置为`unlimited`或`-1`来表示无限制的`rlimit`。

```
start <service>
```

启动一个服务，如果该服务没有在运行的话。注意这不是同步的，即使是同步的，也不能保证操作系统的调度器会充分执行该服务以保障有关服务状态的任何信息。请使用`exec_start`命令来获取同步版本的`start`。

这产生了一个重要的后果：如果这个服务为其他服务提供功能，如提供一个通信管道，那么在这些服务前简单的启动这个服务，是无法保证其他服务请求之前管道是否已经建立。

```
stop <service>
```

停止服务如果当前服务正在运行的话。

```
swapon_all [ <fstab> ]
```

在给定的`fstab`文件上运行`fs_mgr_swapon_all`。如果`fstab`参数也没有指定，在运行时按照顺序从`/odm/etc`、`/vendor/etc`、`/`中扫描`fstab.${ro.boot.fstab_suffix}`、`fstab.${ro.hardware}`、`fstab.${ro.hardware.platform}`。

```
symlink <target> <path>
```

创建一个符号链接。

```
sysclktz <minutes_west_of_gmt>
```

设置系统时钟基数。（0表示系统时钟以GMT计时）

```
trigger <event>
```

触发一个事件。用于将另一个`action`入队列。

```
unmount <path>
```

卸载挂载在该路径上的文件系统。

```
unmount_all [ <fstab> ]
```

在给定的`fstab`文件上运行`fa_mgr_unmount_all`。如果`fstab`参数也没有指定，在运行时按照顺序从`/odm/etc`、`/vendor/etc`、`/`中扫描`fstab.${ro.boot.fstab_suffix}`、`fstab.${ro.hardware}`、`fstab.${ro.hardware.platform}`。

```
verity_update_state
```

内部实现细节是用于更新`dm-verity`和设置被`adb remount`使用的`partition.mount-point.verified`属性值，因为`fs_mgr`不能自己直接设置他们。从`Android 12`开始，这是必须的，因为`CtsNativeVerifiedBootTestCases`将读取属性`partition.${partition}.verified.hash_alg`来检查`sha1`是否未被使用。

```
wait <path> [ <timeout> ]
```

轮询给定的文件是否存在，当找到的时候或者超时的时候返回。如果超时时间未指定，默认的是5秒。超时时间可以是小数，使用浮点数表示。

```
wait_for_prop <name> <value>
```

等待系统属性的值变成期望值，其中参数`value`也可以使用系统属性表示。如果该属性值已经是期望值了，会直接返回。

```
write <path> <content>
```

打开文件，并且通过`write(2)`写入内容。如果文件不存在则创建该文件，如果存在该文件会被截断。参数`content`中可以使用系统属性。

### Imports

```
import <path>
```

解析`init`配置文件以拓展当前配置。如果`path`是一个目录，该目录下的每一个文件都会被解析为配置文件。它不是递归的，嵌套的目录不会被解析。

`import`关键字不是一个命令，而是它自己的一部分，这意味着他不是作为`Action`的一部分发生，而是它是作为一个正在解析的文件处理的，并且遵循下面的逻辑。

`init`进程只有三次导入`.rc`文件的机会：

1. 在初始启动的时候，它会导入`/system/etc/init/hw/init.rc`或者属性`ro.boot.init_rc`所指示的脚本。
2. 在导入`/system/etc/init/hw/init.rc`之后会立即导入`/{system, system_ext, vendor, odm, product}/etc/init/`.
3. (已弃用)当导入`/{system, vendor, odm}/etc/init/`或者指定路径下的`.rc`执行`mount_all`的时候，在`Android Q`以后不再允许。

由于遗留问题，文件的导入顺序有点复杂。但是能保证一下内容:

1. `/system/etc/init/hw/init.rc`被解析，然后递归导致它的每个导入。
2. `/system/etc/init/`下的内容按照字母顺序依次解析，在解析每个文件时递归导入。
3. 对于`/system_ext/etc/init/`、`/vendor/etc/init/`、`/odm/etc/init/`、`/product/etc/init/`目录执行步骤2

下面的伪代码可能会描述的更清晰一些：

```
fn Import(file)
  Parse(file)
  for (import : file.imports)
    Import(import)

Import(/system/etc/init/hw/init.rc)
Directories = [/system/etc/init, /system_ext/etc/init, /vendor/etc/init, /odm/etc/init, /product/etc/init]
for (directory : Directories)
  files = <Alphabetical order of directory's contents>
  for (file : files)
    Import(file)
```

`Actions`会按照解析的顺序执行。例如`post-fs-data`操作，在`/system/etc/init/hw/init.rc`中的`post-fs-data`总是第一个被执行按照他们在文件中出现的顺序。然后是`/system/etc/hw/init.rc`文件中导入的`post-fs-data`执行等。

### Properties

`init`进程通过以下属性提供状态信息。

`init.svc.<name>`给定名称的服务的状态信息。（`stopped`, `stopping`, `running`, `restarting`）

`dev.mnt.dev.<mount_point>`，`dev.mnt.blk.<mount_point>`，`dev.mnt.rootdisk.<mount_point>`

与参数`mount_point`相关联的块设备。其中`mount_point`已经从`/`目录被替换成了`.`目录，因此如果引用根节点`/`，则会使用`/root`。`dev.mnt.dev.<mount_point>`表示着挂载到文件系统上的块设备（例如`dmN`或者`sdaN/mmcblk0pN`访问`/sys/fs/ext4/${dev.mnt.dev.<mount_point>}/`）。

`dev.mnt.blk.<mount_point>`表示块设备上的磁盘分区。（如`sdaN/mmcblk0pN`访问`/sys/class/block/${dev.mnt.blk.<mount_point>}/`）

`dev.mnt.rootdisk.<mount_point>`表示上述磁盘分区中的root磁盘。(如`sda/mmcblk0`访问`/sys/class/block/${dev.mnt.rootdisk.<mount_point>}.queue`)

`init`进程会响应以`ctl`开头的属性，这些属性采用`ctl.[<target>_]<command>`的格式，其值作为参数。参数`target`是可选的，它主要指定匹配的服务。`target`只有一个选项即`interface`，它表示属性值指向服务提供的接口而不是服务名称本身。

例如：

`SetProperty("ctl.start", "logd")`会通过`start`命令启动`logd`。

`SetProperty("ctl.interface_start", "aidl/aidl_lazy_test_1")`会通过`start`命令启动`aidl_lazy_test_1`接口的服务。

注意这些属性只能设置，是无法读取到的。

这些命令如下：`start`、`restart`、`stop`

这相当于在属性值指向的服务上执行`start`、`restart`、`stop`命令。

`oneshot_on`、`oneshot_off`命令会打开或关闭属性值所指向的服务的`oneshot`标记，这特别适用于延迟加载的`Hal`，当它是延迟加载的`Hal`时，`oneshot`必须是打开状态，否则是关闭状态。

`sigstop_on`、`sigstop_off`命令会打开或者关闭属性值所指向的服务的`sigstop`功能。有关此特性的更多详细信息，请参阅下面的`Debugging`章节。

### Boot timing

`init`进程会在系统属性中记录一些启动时机相关的信息。

```
ro.boottime.init
```

启动后的时间，以`ns`为单位（通过`CLOCK_BOOTTIME`时钟），从`init`进程的第一阶段开始。

```
ro.boottime.init.first_stage
```

init进程的第一阶段启动花费的时间，单位`ns`。

```
ro.boottime.init.selinux
```

`SELinux`过程花费的时间，单位`ns`。

```
ro.boottime.init.modules
```

加载内核模块花费的时间，单位`ns`。

```
ro.boottime.init.cold_boot_wait
```

`init`进程等待`ueventd`冷启动阶段结束的时间，单位`ns`。

```
ro.boottime.<servicename>
```

启动后服务首次启动的时间，单位`ns`（通过`CLOCK_BOOTTIME`时钟）。

### Bootcharting

这个版本的`init`包含执行`bootchart`的代码：生成日志文件，这些文件后面可以通过[http://www.bootchart.org/](http://www.bootchart.org/)处理。

在模拟器上，使用`-bootchart timeout`操作来启动`bootchart`，并设置超时时间。

在设备上：

```
adb shell `touch /data/bootchart/enabled`
```

当你收集完数据后，记得不要忘记删除这个文件。

日志文件会被写入到`/data/bootchart/`，并且提供了一个脚本来检索文件并创建一个`bootchart.tgz`，并可以被`bootchart`的命令行工具使用：

```
sudo apt-get install pybootchartgui
# grap-bootchart.sh uses $ANDROID_SERIAL.
$ANDROID_BUILD_TOP/system/core/init/grab-bootcahrt.sh
```

需要注意一点，`bootchart`会显示`init`进程从时间0开始执行一样，因此你需要查看`dmesg`来确定内核实际启动`init`的时间。

### Comparing two bootcharts

有一个名为`compare-bootcahrts.py`的方便的脚本可以用来比较所选进程的开始和结束时间。前面提到的`grab-bootcharts.sh`会在`/tmp/android-bootcahrt`下创建一个叫做`bootchart.tgz`的压缩文件，如果在同一个机器上的不同目录下留下了两个这样的压缩文件，这个脚本可以列出他们时间戳的差异。例如：

使用方式：`system/core/init/compare-bootcharts.py base-bootchart-dir exp-bootchart-dir`

```
process: baseline experiment (delta) - Unit is ms (a jiffy is 10 ms on the system)
------------------------------------
/init: 50 40 (-10)
/system/bin/surfaceflinger: 4320 4470 (+150)
/system/bin/bootanimation: 6980 6990 (+10)
zygote64: 10410 10640 (+230)
zygote: 10410 10640 (+230)
system_server: 15350 15150 (-200)
bootanimation ends at: 33790 31230 (-2560)
```

### Systrace

`SysTrace`([http://developer.android.com/tools/help/systrace.html](http://developer.android.com/tools/help/systrace.html))可用于在`userdebug`或`eng`构建模式下获取启动时间的性能分析报告。

下面是跟踪`wm`和`am`事件的示例：

```
$ANDROID_BUILD_TOP/external/chromium-trace/systrace.py \
   wm am --boot
```

这个命令会导致这台机器重启，设 bn备重启完成后，追踪报告会被从设备设备上获取并写入到`trace.html`中，通过`CTRL+C`获取到。

限制：记录追踪事件是在持久系统属性之后开始的，因此在此之前的时间不会被记录。一些服务如`vold`、`surfaceflinger`、`servicemanager`会受到该限制的影响，因为他们是在持久系统属性启动前启动的。`zygote`进程以及它`fork`出的其他进程是不会受到影响的。

### Debugging Init

当一个服务从`init`启动时，他可能会执行`execv()`失败，这不是典型的错误，并且可能在新的服务启动时指向一个链接器错误。在`Android`中链接器会打印它的日志到`logd`和`stderr`中，因此他们可以在`logcat`中看到。如果在`logcat`可以被访问之前遇到了错误，可以使用`stdio_to_kmsg`服务命令将链接器输出到`stderr`中的日志重定向到`kmsg`，然后就可以通过串行端口读取这些日志了。

不建议在没有init的情况下启动init服务，因为init会设置大量的难以手动复制的环境（用户、组、安全标签、功能等）。

如果需要从一开始就调试服务，则可以添加`sigstop`命令选项。该命令会在调用`exec`之前就立即向服务发送`SIGSTOP`。这为开发者提供了一个窗口，可以在继续使用`SIGCONT`之前附加调试器，`trace`等。

这个标志也可以通过`ctl.sigstop_on`和`ctl.sigstop_off`属性来动态控制。

下面就是一个通过上述方法动态调试`logd`的示例：

```
stop logd
setprop ctl.sigstop_on logd
start logd
ps -e | grep logd
> logd          4343     1   18156   1684 do_signal_stop 538280 T init
gdbclient.py -p 4343
b main
c
c
c
> Breakpoint 1, main (argc=1, argv=0x7ff8c9a488) at system/core/logd/main.cpp:427
```

下面也是同样的例子，只是用了`strace`：

```
stop logd
setprop ctl.sigstop_on logd
start logd
ps -e | grep logd
> logd          4343     1   18156   1684 do_signal_stop 538280 T init
strace -p 4343

(From a different shell)
kill -SIGCONT 4343

> strace runs
```

### 初始化脚本的验证

`init`脚本会在构建的时候检查其正确性，具体检查如下：

1. 是否是格式良好的`Action`、`Service`以及`Import`。例如：在`Action`前没有加`on`，在`import`后没有多余的行。
2. 所有的命令都映射上一个有效的关键字，并且参数也在正确的范围内。
3. 所有的服务都是可用的，这比检查命令的方式更严格，因为服务的参数是可选的并且是完全解析的。例如`UID`和`GID`必须解析。

`init`脚本的其他部分仅在运行时解析，因此在构建期间不会检查，包括以下部分：

1. 命令参数的有效性，例如：不检查文件路径是否实际存在，`SELinux`是否允许才做，`UID`和`PID`是否解析。
2. 不检查服务是否存在并且是否是有效的`SELinux`定义
3. 不检查服务是否之前在其他脚本中已经定义过

### Early Init Boot Sequence

最早初始化引导的顺序分为三个阶段：第一阶段、`SELinux`设置、第二阶段。

第一阶段的初始化负责加载系统其余部分的最低需求。具体来说，包括挂载`/dev`、`/proc`以及挂载`early mount`的分区（需要包含系统代码的所有分区，如`system`和`vendor`），并且将`system.img`挂载到设备的`/`目录。

注意在`Android Q`中，`system.img`总是包含了`TARGET_ROOT_OUT`并且在第一阶段的初始化中挂载到`/`上。`Android Q`还需要动态分区，因此需要`ramdisk`来启动`Android`系统。可以使用`Recovery Ramdisk`来启动系统而不需要一个专用的`ramdisk`。

第一阶段的初始化根据设备的配置有三个变更：

1. 对于`system-as-root`的设备，第一阶段的初始化是`/system/bin/init`的一部分，并且`/init`上的符号链接指向`/system/bin/init`以实现向后的兼容性。这些设备不需要做任何事来挂载`system.img`，因为根据定义，它早已被内核挂载为根文件。
2. 对于具有`ramdisk`的设备，第一阶段的初始化是一个位于`/init`的静态的可执行文件。这些设备挂载`system.img`到`/system`，然后切换到`root`权限将`/system`移动到`/`。挂载完成后会释放掉`ramdisk`的内容。
3. 对于将`Recovery`作为`ramdisk`的设备，第一阶段的初始化包含位于`recovery ramdisk`中的`/init`。这些设备首先切换`root`到`/first_stage_ramdisk`，然后删除环境变量中的`recovery`组件，然后再按照步骤2处理。请注意，是否正常启动还是启动到`recovery`模式，取决于内核命令行或者在`Android S`及以后的版本的`bootconfig`中是否存在`androidboot.force_normal_boot=1`。

当第一阶段的初始化结束后，他会使用`selinux_setup`参数执行`/system/bin/init`，在这个阶段`SELinux`就会可选的编译并加入到系统中。`selinux.cpp`包含更多关于该进程的信息。

最后当该阶段完成后，他会使用`second_stage`参数启动`/system/bin/init`，此时也是`init`的主要阶段运行，他会通过`init.rc`继续启动。

















