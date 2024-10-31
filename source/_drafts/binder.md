---
title: Binder
date: 2022-04-20 14:03:09
categories: Android Framework
tags:
 - binder
banner_img: img/cover/cover-binder.webp
---

Binder是Android系统中为了实现进程间通信而设计的一个功能，能够完成进程间通信的方式有很多，并且各有优缺点，而Binder综合了多种方式的优缺点取其平衡，使用一次拷贝即可完成进程间通信，并且能够实现通信双方的身份校验等。

Binder本质上是注册在内核的一个字符驱动，当应用进程打开驱动的时候，会在内核中申请一块内存与应用进程中的地址空间建立映射关系。从而

