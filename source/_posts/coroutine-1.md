---
title: Kotlin协程的使用
date: 2023-3-15 21:05:26
categories: Kotlin
tags:
 - Coroutine
 - Kotlin
banner_img: img/cover/cover-coroutine-1.webp
---

`Kotlin`目前已经是`Android`开发的首选语言了，其具有丰富的语法糖方便我们开发，以及协程的功能更是大大简化了线程之间的切换处理，本文主要记录协程的基础用法。

### 协程Coroutine

首先回到定义上，协程是什么？在`Kotlin`中，协程可以看做是一个能够随时挂起恢复的代码块，更可以看做是一套线程框架，我们可以使用它实现各种异步操作，最为出名的就是它能以同步方式实现异步操作。

#### 协程的启动

协程是一类特殊的代码块，在它的内部再次启动一个协程块，被称为子协程，在`Kotlin`中有定义几个启动协程的函数，我们通常都是通过他们来启动一个协程树。

- **runBlocking**： 顶层函数，直接启动协程

  `runBlocking`可以直接在任何地方启动一个协程，但是会阻塞当前线程，直到协程执行完毕返回，并且返回值就是协程代码块的返回值，通常我们使用的较少，因为它会阻塞当前线程。

  ```kotlin
  private fun doSomething() {
     // 当前线程本来在做一些操作
      ...
     // 阻塞当前线程
     val res = runBlocking { 
         // 在协程中执行别的操作
         ...
         // 最后一行返回结果，可以省略return@runBlocking
         return@runBlocking result
     }
     // 恢复原线程的执行，继续执行别的逻辑
     ...
  }
  ```

- **launch**：拓展函数，需要在协程作用域内启动协程

  `launch`是`CoroutineScope`的拓展函数，必须通过`CoroutineScope`启动，也正是因为如此，我们可以通过`CoroutineScope`去取消掉它名下的所有启动的协程。

  ```kotlin
  // 在界面destory的时候不要忘记取消它名下的所有协程
  private val scope = MainScope()
  private fun doSomething() {
     // 原线程做一些事
     ...
     val job = scope.launch { 
        // 启动协程去做别的事
     }
     // 原线程继续做原来的事，不受协程影响
     ...
  }
  ```

  使用这种方式启动的协程不会影响原线程，可以理解为启动协程后这部分的代码块就成为异步的了，所以不会影响到后续的逻辑执行，至于这段协程代码块什么时候执行在哪个线程执行，就是协程上下文所决定的了。

  这里启动协程用的是`MainScope`，这是`Android`主线程的作用域，也就是说使用该`scope`启动的协程默认情况下都会执行在主线程上。还有别的如`GlobalScope`，它是全局单例对象，也可以用来启动协程，但是使用它的时候需要注意及时取消，避免引起内存泄漏。

  当然我们也可以`new`一个`CoroutineScope`，同样的是需要注意管理协程的及时取消。如果我们限麻烦，可以使用`lifecycleScope`和`viewModelScope`（需要加对应的`ktx`依赖）来启动协程，这样我们就不需要关注它的取消问题了，因为他们会在对应的组件销毁时直接取消掉。

  还有就是需要注意`launch`是有返回值的，它代表的是这个协程，我们可以通过它获知到协程的状态等信息，也可以通过它取消当前协程的执行。

- **async**：拓展函数，需要在协程作用域内启动协程

  `async`和`launch`一样，都是需要通过`CoroutineScope`来启动的。通常情况下，我们通过`launch`启动协程后就不需要管它了，相当于从当前位置直接剥离出去了。但是有时候我们还需要协程执行的结果，直接使用`launch`肯定是无法满足我们的要求的，因此可以使用`async`。

  它会返回一个`Deferred<T>`，也是一个`Job`的子类，还是可以通过它来完成协程的取消以及状态获取等操作的，但它额外增加了一个功能，就是它能存储协程执行的结果，我们可以通过它拿到协程执行的结果。

  ```kotlin
  val scope = MainScope()
  private fun doSomething() {
     // 启动一个协程
     scope.launch {
         // 在协程中启动另一个协程执行别的操作
         val res = async {
             // 例如做一些耗时操作
         }
         // 等待协程的结果
         val result = res.await()
     }
  }
  ```

  `async`的特点就是可以拿到协程的执行结果，通过`await`获取结果。从上文我们看到，我们并不是直接通过`scope`来启动`async`的，而是在协程的内部启动的。当然直接启动也是可以的，但如果想要获取到协程的结果，则必须在协程代码块中获取，因为`await`方法是`suspend`函数。

#### suspend

前面提到的启动协程的几种方式，其传递的代码块都是通过`suspend`修饰的。该关键字是属于`kotlin`关键字，被他修饰的代码块或者函数表示其是可挂起的，因此也只能运行在协程中，普通函数是无法直接调用`suspend`函数的。

```kotlin
private suspend fun doSomething() {
   val photo = withContext(Dispatchers.IO) {
       ...
   }
   delay(100)
}
```

实际上，`suspend`就是协程的关键字，它修饰的代码块只能在协程中执行，所以只有在`suspend`函数内才能调用别的`suspend`函数，如上面的`withContext`和`delay`方法就是`suspend`方法。

#### 调度器Dispatchers

协程本质上就是一个线程的封装框架，实际底层还是通过线程来处理的。其内置了多个线程池，在协程中被称为调度器，实际就是线程池。

- **Dispatchers.Main**

  主线程调度器，所有通过该调度器调度的协程都会运行在主线程，因此它实际上也是一个单线程的线程池。在`Android`中我们会在主线程中操作`UI`，一般通过`withContext`方法来切换线程，当然我们启动的协程时也可以直接传入`Dispatchers`来实现切换。

  ```kotlin
  private suspend fun doSomething() {
     // withContext必须在suspend代码块中调用
     val photo = withContext(Dispatchers.IO) {
         // IO线程做耗时操作
         ...
     }
     withContext(Dispatchers.Main) {
         // 切换到主线程更新UI
         ...
     }
         
     // 启动一个协程并指定运行在主线程上
     scope.launch(Dispatchers.Main) { 
         ...
     }
  }
  ```

  为什么我们喜欢通过`withContext`来切换线程，而不是通过`launch`呢？从上面我们也可以看到，`withContext`函数只要在`suspend`代码块中都是可以调用的，而`launch`必须在`scope`的作用域内才能启动协程。同时`launch`是启动另一个协程，相当于从当前协程中脱离出去了，而`withContext`并不会额外起一个协程，同时它还能有返回值，灵活性比起一个新协程高很多。

- **Dispatchers.IO**

  `IO`线程池，通常被用来执行一些`IO`操作密集型的工作。

- **Dispatchers.Default**

  默认线程池，通常被用来执行一些`CPU`操作密集型的工作。

- **Dispatchers.Unconfined**

  无限制调度器，即不主动修改线程。如果在协程的执行过程中发生了线程变化，则恢复后的线程仍是变化的那个线程，如下示例：

  ```kotlin
  private suspend fun doSomething() = withContext(Dispatchers.Unconfined){
     log("1")
     withContext(Dispatchers.Unconfined) {
        log("2")
     }
     log("3")
     withContext(Dispatchers.Default) {
        log("4")
     }
     log("5")
  }
  
  private fun log(msg:String) {
      Log.d(TAG, "${Thread.currentThread().name} = $msg")
  }
   
  -------------------------
   D  main = 1
   D  main = 2
   D  main = 3
   D  DefaultDispatcher-worker-1 = 4
   D  DefaultDispatcher-worker-1 = 5
  ```

- 自定义调度器

  自定义调度器可以通过继承自`CoroutineDispatcher`来实现，但是会比较麻烦。而我们知道实际的调度器就是个线程池，因此可以直接创建出线程池`Executor`，然后通过拓展方法`asCoroutineDispatcher`转换成调度器。

  ```kotlin
  private suspend fun doSomething() {
      val custom = Executors.newCachedThreadPool().asCoroutineDispatcher()
      withContext(custom) {
          ...
      }
  }
  ```



#### 协程的取消

`Job`代表的是协程任务，而取消也是通过`Job#cancel`进行取消的。但是它的取消并不是直接取消掉，而是需要协程本身的响应。

```kotlin
private fun doSomething() {
    val job = scope.launch {
        for (i in 0..100) {
            Thread.sleep(1000)
            log("协程任务：$i")
        }
    }
    Thread.sleep(3000)
    job.cancel()
    log("取消协程")
}
-----------------

 D  协程任务：0
 D  协程任务：1
 D  取消协程
 D  协程任务：2
 ....
```

像上述示例，我们启动的协程并在其中做循环操作，然后在3秒后取消协程，但是实际它并没有被取消掉。这是因为协程本身并没有去响应取消的操作，正常我们启动的协程必须要响应取消操作。

上述代码中的`for`循环中，将`Thread.sleep`改为`delay`就可以正常取消了，因为协程库中所有提供的可挂起函数都是已经适配了取消操作的，所以我们可以通过`delay`来响应取消操作。但是这里我们是通过`sleep`模拟的耗时操作，实际中是不能直接替换成`delay`的，所以我们需要别的方式，如：`yield`。

```kotlin
private fun doSomething() {
    val job = scope.launch {
        for (i in 0..100) {
            yield()
            Thread.sleep(1000) // delay(1000)
            log("协程任务：$i")
        }
    }
    Thread.sleep(3000)
    job.cancel()
    log("取消协程")
}
```

通过`yield`更贴切实际开发，因为中间的1秒的耗时操作是真实耗时的，无法被替换成`delay`的。而`yield`表示的是让出当前协程的调度，让其他协程有机会在对应的线程中执行，正常是不会影响到我们的执行的，所以响应协程的取消主要就是要在代码块中存在协程的检查点，这个检查点可以是协程提供的挂起函数。

如果我们不想直接使用协程的挂起函数，那么可以使用`isActive`来进行判断，当协程取消时，该属性会被置为false，我们可以通过这个属性来取消协程。

```kotlin
private fun doSomething() {
    val job = scope.launch {
        for (i in 0..100) {
            if (!isActive) {
                // 当前状态为false时，直接结束协程的执行
                return@launch
            }
            Thread.sleep(1000) // delay(1000)
            log("协程任务：$i")
        }
    }
    Thread.sleep(3000)
    job.cancel()
    log("取消协程")
}
```

通过在`for`循环中检查`isActive`的值来结束协程，这样是可以结束掉协程的，但这属于正常的退出。对于取消操作，我们在结束时还需要抛出`CancellationException`给到上层。所以上面的`return@launch`应该修改为`throw CancellationException("msg")`，当然还有更优雅的方式，就是将整个判断改为`ensureActive()`就可以了，它内部也是这样的一个判断过程。

所以：如上示例我们的耗时操作是多个耗时操作，每个耗时操作是1秒，所以当我们正在执行操作时被取消了，此时会过去1秒后再次循环时才会进入判断并取消掉。 

#### 异常处理

协程的执行过程中是可能会发生异常的，正常我们都是通过`try catch`进行捕获的，我们在协程内部也可以通过`try catch`在具体的位置进行捕获异常，但是我们无法直接对整个协程进行捕获异常。

```kotlin
private fun doSomething() {
    // 无法捕获到异常，会直接闪退
    try {
        scope.launch {
            1 / 0
        }
    } catch (e: Exception) {
    }
    // 协程内部可以捕获到
    scope.launch { 
        try {
            1 / 0
        } catch (e: Exception) {
        }
    }
    // 无法捕获异常，会直接闪退
    scope.launch {
        try {
            launch { 
                1 / 0
            }
        } catch (e: Exception) {}
    }
}
```

所以不论是父协程还是子协程，异常都是无法直接`try catch`的。协程中提供了一个专门用于处理异常的捕获器，叫做`CoroutineExceptionHandler`，整个协程树下的异常都会被其捕获。

```kotlin
@Suppress("FunctionName")
public inline fun CoroutineExceptionHandler(crossinline handler: (CoroutineContext, Throwable) -> Unit): CoroutineExceptionHandler =
    object : AbstractCoroutineContextElement(CoroutineExceptionHandler), CoroutineExceptionHandler {
        override fun handleException(context: CoroutineContext, exception: Throwable) =
            handler.invoke(context, exception)
    }
```

方法名和返回值类型是一样的，这是方便我们直接创建异常处理器。正常直接通过该方法传递一个异常处理的表达式即可，如下例：

```kotlin
private val scope = CoroutineScope(CoroutineExceptionHandler { coroutineContext, throwable -> 
    // 这里处理异常情况
    log("捕获到的协程的异常： $throwable")
})
    
private fun doSomething() {
    scope.launch {
       1 / 0
    }
}
```

#### 回调转协程

协程是`Kotlin`中的特性，其底层仍是通过回调方式完成的，实际上协程也提供给了我们一些方法来处理回调问题。我们的老项目，大多数都是`Java`实现的，基本上所有的异步操作都是通过回调的方式实现的。而有了协程后，再也难以忍受回调了，我们迫切希望使用协程。

然而使用协程重写一份肯定是非常消耗人力的，并且会对老的代码带来改动，因此我们采用包装的方式，将回调转成协程，这样就不需要改动老代码，而新功能就可以直接使用协程了。

```java
public static void request(String url,  Callback callback) {
    Request request = new Request.Builder()
            .url(url)
            ...
            .build();
    client.newCall(request)
            .enqueue(new okhttp3.Callback() {
                @Override
                public void onFailure(@NonNull Call call, @NonNull IOException e) {
                    callback.onFail(e);
                }
                @Override
                public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                    callback.onSuccess(response.body());
                }
            });
}

public interface Callback {
    void onSuccess(ResponseBody body);
    void onFail(Throwable throwable);
}

// 实际使用中通过回调处理
request(url, new Callback() {
    @Override
    public void onSuccess(ResponseBody body) {
        // 处理网络请求成功的逻辑
    }
    @Override
    public void onFail(Throwable throwable) {
       // 处理失败的逻辑
    }
});
```

如上，通常是我们简单封装网络请求的一种方式，实际使用通过`request`方法进行网络请求，当然这里只是简化逻辑，实际可能比这个复杂，但整体还是使用的回调的方式。然后我们引入`kotlin`以及协程后，肯定不想再这样进行网络请求，肯定想要用更时髦的协程方式，因此我们在`kotlin`中创建一个新的方法来包装回调方法：

```kotlin
private suspend fun request(url:String): ResponseBody? = suspendCancellableCoroutine { result ->
    kotlin.runCatching {
        NetUtils.request(url, object : NetUtils.Callback {
            override fun onSuccess(body: ResponseBody?) {
                result.resumeWith(Result.success(body))
            }

            override fun onFail(e: Throwable) {
                result.resumeWithException(e)
            }
        })
    }.onFailure {
        result.resumeWithException(it)
    }
}

// 实际使用
launch {
    val body = request(url)
    // 处理逻辑
}
```

可以看到，通过`suspendCancellableCoroutine`可以包裹整块逻辑，然后在后面的代码块中执行我们实际的请求逻辑，这里并没有重新封装网络请求，仍然是调用的老的回调方式的网络请求，然后在回调中将协程的结果返回，这样就可以将回调转成协程了，使用方式也更加简单。































