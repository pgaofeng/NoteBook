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

## 原理分析

我们知道`Handler`是可以跨线程进行交互的，那么如何跨线程呢？首先线程间的数据本身就是可以共享的，我们可以在某个线程中定义一个数据结构，然后在另一个线程中向这个数据结构中写入数据，这样两个线程就可以交换数据了。生产者消费者模式就是这个原理，而`Handler`消息机制，本质上也是这个原理。

在`Handler`消息机制中，`MessageQueue`就是这个共享的数据结构，它存在于`Looper`中，也就是说如果我们想要在某个线程中启用`Handler`消息机制，则必须创建一个`Looper`。
```java
  private Looper(boolean quitAllowed) {
    mQueue = new MessageQueue(quitAllowed);
    mThread = Thread.currentThread();
  }
```
在`Looper`的构造方法中会创建一个`MessageQueue`来接受数据，但是它是私有方法，无法直接创建，我们正常是通过`prepare`方法创建。
```java
  @UnsupportedAppUsage
  static final ThreadLocal<Looper> sThreadLocal = new ThreadLocal<Looper>();

  public static void prepare() {
    prepare(true);
  }

  private static void prepare(boolean quitAllowed) {
    if (sThreadLocal.get() != null) {
        throw new RuntimeException("Only one Looper may be created per thread");
    }
    sThreadLocal.set(new Looper(quitAllowed));
  }
```
从`prepare`中可以看到，如果当前线程中已经创建过了`Looper`，则直接抛出异常，否则创建`Looper`并存入到`ThreadLocal`中，使得一个线程中只存在一个`Looper`，从而保障了一个线程只有一个`MessageQueue`。`ThreadLocal`是线程局部变量，它通常会被定义成静态变量供多个线程存储和获取变量的，本质上就是拿到线程的`ThreadLocalMap`，然后往里面存数据就行了，这个不需要过多的了解。
```java
public static void loop() {
    // 获取到当前线程对应的Looper
    final Looper me = myLooper();
    if (me == null) {
        throw new RuntimeException("No Looper; Looper.prepare() wasn't called on this thread.");
    }

     me.mInLoop = true;

     for (;;) {
        if (!loopOnce(me, ident, thresholdOverride)) {
            return;
        }
     }
}

public static @Nullable Looper myLooper() {
    return sThreadLocal.get();
}
```
创建完`Looper`之后，就通过`loop()`去循环读取`MessageQueue`中的消息了。注意`loop`是个死循环，当前线程的逻辑会一直卡在这里无法再做别的事情了。因此，我们必须在`prepare`和`loop`之间创建一个或多个`Handler`，然后将`Handler`提供出去以便其他线程向当前线程中发送消息，通常的写法如下：
```java
class MyThread extends Thread {
    
    private Handler mHandler;
    
    @Override
    public void run() {
        super.run();
        Looper.prepare();
        mHandler = new Handler(Looper.myLooper());
        Looper.loop();
    }
}
```
但是主线程不是我们启动的，我们又该如何获取到`Handler`，如何创建`Looper`，然后向主线程发消息呢？
```java
  @UnsupportedAppUsage
  private static Looper sMainLooper;
  
  @Deprecated
  public static void prepareMainLooper() {
    prepare(false);
    synchronized (Looper.class) {
      if (sMainLooper != null) {
        throw new IllegalStateException("The main Looper has already been prepared.");
      }
      sMainLooper = myLooper();
    }
  }
```
主线程走的是另一个方法`prepareMainLooper`，当应用的主线程启动后，会调用`prepareMainLooper`创建`Looper`，并赋值给静态变量`sMainLooper`。因此对于应用而言，`sMainLooper`是不会为空的，我们也可以通过它来创建`Handler`。
```
private Handler mMainHandler = new Handler(Looper.getMainLooper);
```
然后便是`Handler`了，由于`Handler`是用于发送消息的，所以`Handler`必须能够获取到`Looper`以便向它的`MessageQueue`中发送消息。因此，`Handler`构造方法中，必须传入`Looper`。
```java
  // 空参数构造方法，不建议使用
  @Deprecated
  public Handler() {
    this(null, false);
  }

  // 未提供Looper的构造方法，不建议使用
  public Handler(@Nullable Callback callback, boolean async) {
    ...
    // 没有传入looper，直接从当前线程中获取Looper
    mLooper = Looper.myLooper();
    // 当前线程没有启用Looper，直接抛异常
    if (mLooper == null) {
      throw new RuntimeException(
        "Can't create handler inside thread " + Thread.currentThread()
            \+ " that has not called Looper.prepare()");
    }
    mQueue = mLooper.mQueue;
    mCallback = callback;
    mAsynchronous = async;
    mIsShared = false;
  }

  // 构造方法中传入Looper，推荐使用
  public Handler(@NonNull Looper looper) {
    this(looper, null, false);
  }

  // 不允许app使用
  @UnsupportedAppUsage
  public Handler(@NonNull Looper looper, @Nullable Callback callback, boolean async) {
    this(looper, callback, async, /* shared= */ false);
  }

  // 不允许app使用
  /** @hide */
  public Handler(@NonNull Looper looper, @Nullable Callback callback, boolean async,
      boolean shared) {
    mLooper = looper;
    mQueue = looper.mQueue;
    mCallback = callback;
    mAsynchronous = async;
    mIsShared = shared;
  }
```
对于空参数的构造方法，则直接从当前线程获取`Looper`，获取不到直接抛异常。当然，不带`Looper`的构造方法已经被标记为`Deprecated`了，再去掉其他的`hide`的方法等，我们实际使用中通常用的是`public Handler(@NonNull Looper looper)`这个构造方法。
`Handler`有很多的发送消息的方法，但最终都是走到了同一个方法中去发送数据。并且最终也是通过`queue.enqueueMessage`加入到消息队列中。

```java
private boolean enqueueMessage(@NonNull MessageQueue queue, @NonNull Message msg,
      long uptimeMillis) {
    // 消息的target赋值为当前handler，最终message会交给target执行的handler执行
    msg.target = this;
    msg.workSourceUid = ThreadLocalWorkSource.getUid();

    if (mAsynchronous) {
       msg.setAsynchronous(true);
    }
    return queue.enqueueMessage(msg, uptimeMillis);
}
```
虽然`Handler`有很多的发送消息的方法，但最终也是调用了`queue.enqueueMessage`将消息传入到消息队列中。所以，它的这些方法只是为了方便我们使用而已，将一些参数进行拆分，方便我们快速编码。不管发送时传入的参数是什么，最终都会被构建成一个`Message`对象，这个`Message`就是消息的载体，它代表了一个消息。因为消息会有很多很多，为了避免频繁的创建和销毁，它被设计成一个单链表结构，并设计了一个消息池，消息池中存放的是用于重复利用的`Message`，他们以单链表的形式存在。因此，我们如果要直接发送`Message`的话，切记不要直接`new`，而是应该通过`Message.obtain`方法从消息池中获取，以达成重复利用的目的。

```java
public final class Message implements Parcelable {
    // 用于区分消息类型，用户自定义
    public int what;

    // 消息可携带简单参数
    public int arg1;
    public int arg2;

    // 消息可携带复杂对象
    public Object obj;

    // 标记当前消息是否正在被使用
    @UnsupportedAppUsage
    /*package*/ int flags;

    // 消息具体的需要被执行的时间点，消息队列中以此参数排序
    @UnsupportedAppUsage
    @VisibleForTesting(visibility = VisibleForTesting.Visibility.PACKAGE)
    public long when;

    // 消息应该由哪个Handler处理执行
    @UnsupportedAppUsage
    /*package*/ Handler target;

    // 当前消息是一个可执行的代码块逻辑
    @UnsupportedAppUsage
    /*package*/ Runnable callback;

    // 单链表指针
    @UnsupportedAppUsage
    /*package*/ Message next;
}
```

消息的结构比较简单，一个用于区分消息的参数，三个用于携带数据的参数，以及一个用于存储可执行代码块的参数，这里不需要详细解释，接下来继续看消息进入消息队列的逻辑。注意这里的消息队列`MessageQueue`只是名字叫做消息队列，它的结构实际不是一个队列的数据结构，而是一个以消息执行时间排序的`Message`为节点的单链表结构。



```java
boolean enqueueMessage(Message msg, long when) {
    // 必须有target，正常发送的消息都有
    if (msg.target == null) {
        throw new IllegalArgumentException("Message must have a target.");
    }
    synchronized (this) {
        // message已经被用过了，没有被回收
        if (msg.isInUse()) {
            throw new IllegalStateException(msg + " This message is already in use.");
        }
        // 正在退出looper，直接回收msg
        if (mQuitting) {
            IllegalStateException e = new IllegalStateException(
              msg.target + " sending message to a Handler on a dead thread");
            Log.w(TAG, e.getMessage(), e);
            msg.recycle();
            return false;
        }
        // 标记为已使用的状态，并设置消息的执行时机
        msg.markInUse();
        msg.when = when;
        Message p = mMessages;
        // 是否需要唤醒Looper
        boolean needWake;
        if (p == null || when == 0 || when < p.when) {
            // 队列中无数据，插入到表头
            msg.next = p;
            mMessages = msg;
            needWake = mBlocked;
        } else {
            needWake = mBlocked && p.target == null && msg.isAsynchronous();
            Message prev;
            // 遍历消息队列，按时间顺序插入消息
            for (;;) {
                prev = p;
                p = p.next;
                if (p == null || when < p.when) {
                    // 需要执行的消息比当前消息早，则插入到它前面
                    break;
                }
                if (needWake && p.isAsynchronous()) {
                    needWake = false;
                }
            }
            // 插入到消息的前面
            msg.next = p;
            prev.next = msg;
        }
        // 唤醒Looper
        if (needWake) {
           nativeWake(mPtr);
        }
   }
   return true;
}
```

整体看下来，在消息入队列时做了两件事：一是按照`Message.when`的时间顺序将新的`Message`插入到消息队列中，一是决定是否唤醒`Looper`线程。如果消息队列中没有消息并且当前`Looper`线程是阻塞的，则唤醒`Looper`。另外如果消息队列中有消息，但是`Looper`是阻塞的并且当前的消息是异步消息，则也唤醒`Looper`。

前面我们看到的`MessageQueue`插入数据的逻辑，实际上是发生在`Handler.sendMessage`所在的线程。因为我们开启`Looper`循环后，`Looper`所在的线程就会一直循环从`MessageQueue中`取数据，取不到时就会阻塞。因此，在`MQ`收到消息后，会选择是否唤起`Looper`来处理新来的消息。重新看回`Looper.loop`方法：

```java
public static void loop() {
    ...
    for (;;) {
        if (!loopOnce(me, ident, thresholdOverride)) {
            return;
        }
    }
}
```

也就是说，`Looper`开启后就会一直死循环读取，而读取的逻辑则是发生在`loopOnce`中：

```java
private static boolean loopOnce(final Looper me,
            final long ident, final int thresholdOverride) {
    // 从消息队列中获取一个消息，可能会阻塞
    Message msg = me.mQueue.next();
    // 按照正常逻辑，msg不可能为空，因为获取不到消息时会阻塞，只有looper退出时才会返回null
    // 当msg为空，也就代表着loop方法的结束，整个消息机制的结束。
    if (msg == null) {
        return false;
    }

    // 通过Looper#setMessageLogging可以设置日志打印类，可以打印出每个消息的执行情况，
    // 我们可以通过这个记录每个Message的执行实际，执行耗时等信息，可用于监控线程是否卡顿
    final Printer logging = me.mLogging;
    if (logging != null) {
        logging.println(">>>>> Dispatching to " + msg.target + " "
                + msg.callback + ": " + msg.what);
    }
    // 这个类才是监控消息执行的，在消息执行前、执行后、以及发生异常时，都会有回调到
    // observer中，这个类可以帮助我们监控消息队列的执行情况，比前面的logging更好用。
    // 但是，它是hide的，我们正常情况下无法使用
    final Observer observer = sObserver;
    ...
    if (observer != null) {
        // 消息执行前的回调
        token = observer.messageDispatchStarting();
    }
    try {
        // 取出消息对应的handler，通过dispatchMessage处理消息
        msg.target.dispatchMessage(msg);
        // 消息执行后的回调
        if (observer != null) {
            observer.messageDispatched(token, msg);
        }
    } catch (Exception exception) {
        // 异常时的回调
        if (observer != null) {
            observer.dispatchingThrewException(token, msg, exception);
        }
        throw exception;
    } finally {
        ...
    }
    // 消息执行后的logging打印
    if (logging != null) {
        logging.println("<<<<< Finished to " + msg.target + " " + msg.callback);
    }
    // 回收消息，会将消息状态重置，并标记未使用，然后放回到消息池中等待复用
    msg.recycleUnchecked();
    // 返回true，因此在looper中会再次调用到loopOnce方法
    return true;
}
```

前面的`loopOnce`从名字也能看出来是循环一次的意思，实际它的逻辑也是如此。首先通过`MessageQueue.next`取出一个消息，注意该消息一定不为空，因为取不到消息的时候会阻塞住，直到取到消息才会返回，当然如果`Looper`被退出的话是会返回`null`的，然后就是通过`Message`对应的`target`去`dispatchMessage`。从这里也能看到线程是如何切换的了，首先在其他线程通过`Handler`发送消息，这个消息会是一个数据或者一个代码块`Runnable`，然后被包装成`Message`，最终在`Looper`线程中通过`Handler.dispatchMessage`处理。

因此我们接下来的关注点有两点：一是`MessageQueue.next`是如何取消息的，一是`Handler.dispatchMessage`是如何处理消息的，先看`next`：

```java
Message next() {
  // native的指针，用于阻塞和唤醒的
  final long ptr = mPtr;
  if (ptr == 0) {
      return null;
  }

  int pendingIdleHandlerCount = -1; // -1 only during first iteration
    
  // 阻塞时间，当没有消息时取值为-1，表示一直阻塞；有消息时但是不能执行，说明该消息的
  // 执行时间是在未来的，因此取值为msg.when - now
  int nextPollTimeoutMillis = 0;
    
  // 这里也是一个死循环，说明如果取不到数据，是会继续循环去取，直到取到message为止，
  // 因此说这个方法的返回值不会为null，除非Looper被quit才会返回null。
  for (;;) {
    // 阻塞一段时间nextPollTimeoutMillis，第一次的时候该值为0不会被阻塞，
    // 后续就可能会被阻塞住，直到第一个消息的执行时间点到达
    nativePollOnce(ptr, nextPollTimeoutMillis);

    synchronized (this) {
      final long now = SystemClock.uptimeMillis();
      Message prevMsg = null;
      Message msg = mMessages;
      // target为空，说明msg是一个消息屏障
      if (msg != null && msg.target == null) { 
          // 遇到消息屏障后，该屏障后的所有普通消息不再执行，但是异步消息还是会执行的，
          // 因此这里使用循环查找消息屏障后的第一个异步消息返回
          do {
              prevMsg = msg;
              msg = msg.next;
           } while (msg != null && !msg.isAsynchronous());
       }
       if (msg != null) {
           // 找到了消息，注意msg的初始值是mMessage，也就是消息队列的第一个值，因此
           // 走到这里说明拿到了一个可能是正常消息，也可能是异步消息的消息
            if (now < msg.when) {
                // 消息的执行时间未到，则计算需要阻塞的时间
                nextPollTimeoutMillis = (int) Math.min(msg.when - now, Integer.MAX_VALUE);
            } else {
                // 找到了消息并且可以执行，标记为非阻塞状态
                mBlocked = false;
                // 将消息从消息队列中取出来
                if (prevMsg != null) {
                    prevMsg.next = msg.next;
                } else {
                    mMessages = msg.next;
                }
                msg.next = null;
                msg.markInUse();
                return msg;
            }
        } else {
            // 未找到消息，则将阻塞时间设置为一直阻塞
            nextPollTimeoutMillis = -1;
        }
        // 只有Looper.quit时，才会返回null
        if (mQuitting) {
              dispose();
              return null;
        }

                // If first time idle, then get the number of idlers to run.
                // Idle handles only run if the queue is empty or if the first message
                // in the queue (possibly a barrier) is due to be handled in the future.
                if (pendingIdleHandlerCount < 0
                        && (mMessages == null || now < mMessages.when)) {
                    pendingIdleHandlerCount = mIdleHandlers.size();
                }
                if (pendingIdleHandlerCount <= 0) {
                    // No idle handlers to run.  Loop and wait some more.
                    mBlocked = true;
                    continue;
                }

                if (mPendingIdleHandlers == null) {
                    mPendingIdleHandlers = new IdleHandler[Math.max(pendingIdleHandlerCount, 4)];
                }
                mPendingIdleHandlers = mIdleHandlers.toArray(mPendingIdleHandlers);
            }

            // Run the idle handlers.
            // We only ever reach this code block during the first iteration.
            for (int i = 0; i < pendingIdleHandlerCount; i++) {
                final IdleHandler idler = mPendingIdleHandlers[i];
                mPendingIdleHandlers[i] = null; // release the reference to the handler

                boolean keep = false;
                try {
                    keep = idler.queueIdle();
                } catch (Throwable t) {
                    Log.wtf(TAG, "IdleHandler threw exception", t);
                }

                if (!keep) {
                    synchronized (this) {
                        mIdleHandlers.remove(idler);
                    }
                }
            }

            // Reset the idle handler count to 0 so we do not run them again.
            pendingIdleHandlerCount = 0;

            // While calling an idle handler, a new message could have been delivered
            // so go back and look again for a pending message without waiting.
            nextPollTimeoutMillis = 0;
        }
    }
```

