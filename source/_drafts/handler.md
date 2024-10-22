---
title: Handler
date: 2022-03-07 12:33:47
categories: Android Framework
tags:
 - Handler
banner_img: img/cover/cover-epoll.webp
---

`Handler`是我们非常熟悉的一个组件，它的主要作用就是进行线程间的交互，通常是主线程与其他工作线程间的交互。这套消息机制在应用开发中用的是最多的，我们使用它来实现切换主线程、发送延时消息等。它主要由`Handler`、`Looper`、`MessageQueue`三个组件组成，其中`Handler`负责发送和处理消息，`Looper`负责循环读取消息，`MessageQueue`负责存储消息。

## 简单介绍

整套消息机制我们应该非常熟悉了，具体的使用就不再赘述，这里只简单介绍下各个组件的作用。

### Handler

`Handler`负责发送消息和处理消息，发送的消息主要是普通消息和`Runnable`消息，通常使用`post`、`postAtTime`、`postDelayed`发送`Runnable`消息，通过`sendEmptyMessage`、`sendMessage`、`sendMessageAtTime`、`sendMessageDelayed`发送普通消息。

这些消息被发送时，都会在消息上指明`target`为当前`Handler`，而等到消息执行时，就会将消息指派给它对应的`Handler`进行处理。

### Message

`Message`是消息的载体，对于普通消息，可以直接通过它的`what`属性进行区分，通过`arg1`和`arg2`承载简单的数据，通过`obj`承载复杂的对象数据；对于`Runnable`消息，通过它的`callback`属性进行承载。同时，`Message`是被设计成单链表结构的，以及一个消息池，被用过的`Message`就会被放在消息池中等待复用，消息池就是一个单链表结构。因此如果我们创建`Message`的时候，最好通过`Message.obtain`方法创建而不是直接`new`以复用`Message`。

### Looper

`Looper`是一个消息机制中的驱动模块，它会循环读取消息队列中的消息，然后将其分发给对应的`Handler`进行处理。当消息队列为空或者没有可执行的消息时，它会阻塞当前线程，当有了可执行的消息时会被唤醒继续循环读取。

### MessageQueue

消息队列`MessageQueue`，主要作用是存储消息，各个`Handler`发送的消息都会进入消息队列，并且按照消息的执行时间进行排序，时间靠前的排在前面。当`Looper`获取消息时，从前向后读取消息，如果消息的执行时间在当前时间之后，就会阻塞一直到执行时间后恢复。

## 源码分析

Handler是可以跨线程进行交互的，
