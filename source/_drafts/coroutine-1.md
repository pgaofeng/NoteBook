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





























