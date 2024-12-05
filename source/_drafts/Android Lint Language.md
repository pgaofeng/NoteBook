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

根据服务的守护进程来将init.rc文件进行区分比以前使用一个完整的init.rc
