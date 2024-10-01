---
title: SharedFlow、StateFlow、SafeFlow的区别
date: 2023-06-05 21:13:04
categories: Kotlin
tags:
 - 协程
 - flow
banner_img: img/cover/cover-flow-2.webp
---

在[协程数据流Flow](https://pgaofeng.github.io/2023/05/22/flow/)中，描述了几种创建`Flow`的方式，如通过`flow{}`或者各种集合的`asFlow`等。然而，这种方式创建的Flow其数据流是固定的，如使用`flow{}`的方式去我们会提供一个代码块，这个代码块负责创建发射数据，但这种方式不是很灵活，我们想要的更是一种可以随时随地创建数据的形式。

## SafeFlow

`SafeFlow`是前面提的那一系列的创建Flow的方法的实际类型，网上通常称其为冷流，即数据流只会在`Collect`的时候去创建。

```kotlin
val mSafeFlow = flow {
    repeat(10) {
        Log.d(TAG, "create data $it")
        emit(it)
        delay(500)
    }
}
```

在上面的代码中，创建了一个`Flow`，但是因为没有末端操作符收集数据，因此实际代码块中的数据是不会执行的，只有在我们`collect`的时候才会去执行代码块中的逻辑，因此被称为冷流。

```kotlin
// 实际返回值类型为SafeFlow
public fun <T> flow(@BuilderInference block: suspend FlowCollector<T>.() -> Unit): Flow<T> = SafeFlow(block)

// 继承类AbstractFlow，并且在collectSafely的时候才执行的代码块
private class SafeFlow<T>(private val block: suspend FlowCollector<T>.() -> Unit) : AbstractFlow<T>() {
    override suspend fun collectSafely(collector: FlowCollector<T>) {
        collector.block()
    }
}

public abstract class AbstractFlow<T> : Flow<T>, CancellableFlow<T> {
	// 可以看到，实际collect的时候才会去执行代码块创建数据
    public final override suspend fun collect(collector: FlowCollector<T>) {
        val safeCollector = SafeCollector(collector, coroutineContext)
        try {
            collectSafely(safeCollector)
        } finally {
            safeCollector.releaseIntercepted()
        }
    }

    public abstract suspend fun collectSafely(collector: FlowCollector<T>)
}
```

## SharedFlow

`SharedFlow`也是`Flow`的一种实现类型，也是我们常用的类型。它是一种热流，即没有collect的时候创建数据的代码块也是可以执行的，因为它在内部增加了一个集合，所有发射的数据都会被存储在集合中，因此它不在乎是否有观察者去消费数据。

```kotlin
public interface SharedFlow<out T> : Flow<T> {
    // 存储数据的集合
    public val replayCache: List<T>
    override suspend fun collect(collector: FlowCollector<T>): Nothing
}

// 如集合一样，提供了一个可变的SharedFlow，并提供两个发射数据的方法
public interface MutableSharedFlow<T> : SharedFlow<T>, FlowCollector<T> {
    // 发射数据
    override suspend fun emit(value: T)
    // 发射数据
    public fun tryEmit(value: T): Boolean
    // 订阅者数据量
    public val subscriptionCount: StateFlow<Int>
    @ExperimentalCoroutinesApi
    public fun resetReplayCache()
}
```

`SharedFlow`本质上也是如集合一样，内部会存储多个数据，当有订阅者的时候，可以从中收集数据。因此其实现也如集合一样，除了有一个`SharedFlow`外，还有一个`MutableSharedFlow`，一个暴露给外部进行订阅，一个用于内部提供数据。`MutableSharedFlow`一共有两个发射数据的方式，`emit`和`tryEmit`（实际上还有一个`emitAll`的拓展方法），区别就是该方法是否会阻塞。

```kotlin
public fun <T> MutableSharedFlow(
    // 重复次数
    replay: Int = 0,
    // 额外缓存区的容量
    extraBufferCapacity: Int = 0,
    // 数据超过缓存区后执行的操作
    onBufferOverflow: BufferOverflow = BufferOverflow.SUSPEND
): MutableSharedFlow<T> {
   ...
    val bufferCapacity0 = replay + extraBufferCapacity
    val bufferCapacity = if (bufferCapacity0 < 0) Int.MAX_VALUE else bufferCapacity0
    // 实际的缓存大小是reply+extraBufferCapacity
    return SharedFlowImpl(replay, bufferCapacity, onBufferOverflow)
}
```

创建`MutableSharedFlow`的方法一共有三个参数，其中第一个参数是重复次数，即当有新的订阅者的时候，它会将缓存区中的数据重新发送给订阅者。而第二个参数是额外的缓存区大小，实际的缓存区的大小为`replay+extraBufferCapacity`。第三个参数是当数据超过了缓存区大小后该如何处理，一共有三种取值方式：`SUSPEND`挂起，直到缓存区空出之后再存入；`DROP_OLDEST`丢弃掉最早的数据；`DROP_LATEST`丢弃掉最新的数据。

前面说了`MutableSharedFlow`提供了两个发射数据的方法，其区别就是是否会`suspend`，而其实际的表现形式也与创建Flow的参数有关。当`onBufferOverflow`的取值为`DROP_LATEST`和`DROP_OLDEST`的时候，或者缓存区未满的时候，`emit`和`tryEmit`实际是一样的效果，都会直接执行结束。否则的话，`emit`方法会被挂起，而`tryEmit`的方法会返回`false`。

```kotlin
val mFlow = MutableSharedFlow<Int>(
    replay = 3,
    extraBufferCapacity = 4,
    onBufferOverflow = BufferOverflow.SUSPEND
)
lifecycleScope.launch {
    repeat(10) {
        Log.d(TAG, "emit it = $it")
        mFlow.emit(it)
    }
 }

// 输出
emit it = 0
emit it = 1
emit it = 2
emit it = 3
emit it = 4
emit it = 5
emit it = 6
emit it = 7
emit it = 8
emit it = 9
```

上述代码可以正常执行，这是符合预期的，注意上面代码输出了十次数据，但是我们缓存区的大小实际是7，为什么`emit`没有被阻塞呢，这是因为此时Flow并没有订阅者，因此emit的时候并不会发生阻塞。当我们再去`collect`的时候，收到是数据实际是`789`，也就是当没有订阅者的时候，实际会以`DROP_OLDEST`的模式执行。

看到`SharedFlow`，是不是感觉实际上就是个生产者消费者模型，实际也是这样，使用`SharedFlow`可以用来协调生产者和消费者的速度不一致的问题。

## StateFlow

`StateFlow`也是`Flow`的一种实现类型，也是我们常用的类型。它是一种热流，即没有`collect`的时候创建数据的代码块也是可以执行的。它是一种有状态的流，这里说的状态不是它本身的状态，而是它的数据就是一种状态。因此该`Flow`本身也会缓存，但是只会存换一个值，同时要求创建`StateFlow`的同时就要传入一个默认的值。

```kotlin
public interface StateFlow<out T> : SharedFlow<T> {
    // 记录状态，也是缓存的值。外部可以直接读取
    public val value: T
}

public interface MutableStateFlow<T> : StateFlow<T>, MutableSharedFlow<T> {
    // 外部可以直接对value进行设置
    public override var value: T

    public fun compareAndSet(expect: T, update: T): Boolean
}
```

如同`SharedFlow`一样，`StateFlow`也提供了一个可以读写的`MutableStateFlow`。注意的是它是可以直接对`value`值进行读写的，不需要在协程中进行处理。当然，正常的`emit`和`collect`还是可以使用的。同时，对于状态的频繁设置，`StateFlow`只会保留最后一个值，其余值都会被忽略掉，类似于使用`MutableSharedFlow(1, 0, BufferOverflow.DROP_OLDEST)`创建的`SharedFlow`。

```kotlin
val mFlow = MutableStateFlow(0)
lifecycleScope.launch {
    // 持续观察mFlow的值的变化
    mFlow.collect {
        Log.d(TAG, "collect = $it")
    }
}
// 可以直接读取状态
Log.d(TAG, "read value = ${mFlow.value}")
// 可以直接设置状态
mFlow.value = 1
mFlow.value = 2
// 也可以使用emit等方法设置
lifecycleScope.launch {
    mFlow.emit(3)
    mFlow.tryEmit(4)
}

// 输出
read value = 0
collect = 4
```

上面的示例中可以看到，可以直接获取和设置`StateFlow`的值，也可以在协程中设置和订阅。注意上面的代码只输出了一次`collect`结果`collect = 4`，这是因为后面又直接设置数据了。正常来说，如果不去设置数据的话，直接collect可会收到一次数据的。

## 冷流和热流

冷流和热流通常情况下是以在没有订阅者的情况下，是否会执行生产数据的逻辑来区分的。那么，`SafeFlow`创建时是传入的一个代码块，然后在代码块中产生数据并发射到Flow中的，当没有订阅者的时候，代码块是不会被执行的，因此它可以称之为冷流。而`SharedFlow`和`StateFlow`内部是有缓存的，并且是提供了两个方法来发射数据。也就是说，产生数据的逻辑实际上与他们是无关的，只是在产生数据之后将数据发射到Flow中而已，那么这样理解的话，`SharedFlow`和`StateFlow`都可以被称为热流的。



