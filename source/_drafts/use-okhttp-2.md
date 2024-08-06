---
title: OkHttp3的简单使用
date: 2021-02-20 17:43:21
tags:
 - OkHttp
categories: Third Libraries
banner_img: img/cover/cover-okhttp.webp
series: okhttp3
---

`OkHttp3`是`Android`中应用最广泛的三方库，几乎所有的安卓应用都使用`OkHttp`来实现网络请求的，基本上都是跟`Retrofit`搭配使用。之前记录了`OkHttp`的使用，但是仅学会使用是最基础的，还应该研究它的源码实现，毕竟这么好的三方库不学习一波实在是太可惜了。



## 引入依赖

```groovy
// OkHttp
implementation("com.squareup.okhttp3:okhttp:4.12.0")
```

权限不要忘记加。

```xml
<uses-permission android:name="android.permission.INTERNET"/>
```

## 简单的请求

分析源码最好的方式是从一个最简单的使用方式开始，逐步追踪，查看其整体的实现逻辑，最后再去研究细节。这里从一个最简单的网络请求开始分析。

```kotlin
private fun request() {
    val request = Request.Builder()
        .url("https://www.wanandroid.com/user/login")
        .build()
    val response = OkHttpClient().newCall(request).execute()
    Log.d(TAG, "response = ${response.body?.string()}")
}
```

首先创建一个`Request`，然后通过`OkHttpClient`创建一个`newCall`，实际得到的是Call的实现类`RealCall`，然后以同步方式执行。最终也就是拿到的是一个`RealCall`，然后将`RealCall`执行得到的`Response`。前面都属于细节，我们最关注的是整个网络请求的整体执行过程，因此我们可以看`RealCall`的`execute`方法。

```kotlin
// RealCall.kt

override fun execute(): Response {
    check(executed.compareAndSet(false, true)) { "Already Executed" }

    timeout.enter()
    callStart()
    try {
      // 加入同步执行队列
      client.dispatcher.executed(this)
      // 执行网络请求
      return getResponseWithInterceptorChain()
    } finally {
      // 同步执行队列中移除call，并触发异步队列的执行
      client.dispatcher.finished(this)
    }
}

// Dispatcher.kt
  @Synchronized internal fun executed(call: RealCall) {
    runningSyncCalls.add(call)
  }
  internal fun finished(call: RealCall) {
    finished(runningSyncCalls, call)
  }

  private fun <T> finished(calls: Deque<T>, call: T) {
    val idleCallback: Runnable?
    synchronized(this) {
      // 移除该Call
      if (!calls.remove(call)) throw AssertionError("Call wasn't in-flight!")
      idleCallback = this.idleCallback
    }
    // 触发异步执行的Call
    val isRunning = promoteAndExecute()

    if (!isRunning && idleCallback != null) {
      idleCallback.run()
    }
  }
```

在`execute`中，整体步骤就是将`Call`添加到`Dispatcher`中的同步执行队列中，然后进行网络请求，请求结束后将该`Call`移除，并触发下一个`Call`的执行。 其中`getResponseWithInterceptorChain`就是最重要的，也是OkHttp中的核心五大拦截器。

```kotlin
// RealCall.kt

@Throws(IOException::class)
  internal fun getResponseWithInterceptorChain(): Response {
    val interceptors = mutableListOf<Interceptor>()
    // 自定义拦截器
    interceptors += client.interceptors
    interceptors += RetryAndFollowUpInterceptor(client)
    interceptors += BridgeInterceptor(client.cookieJar)
    interceptors += CacheInterceptor(client.cache)
    interceptors += ConnectInterceptor
    if (!forWebSocket) {
      // 自定义网络拦截器
      interceptors += client.networkInterceptors
    }
    interceptors += CallServerInterceptor(forWebSocket)

    // 最终执行的拦截器链
    val chain = RealInterceptorChain(
        call = this,
        interceptors = interceptors,
        // 当前执行的拦截器的下标
        index = 0,
        exchange = null,
        request = originalRequest,
        connectTimeoutMillis = client.connectTimeoutMillis,
        readTimeoutMillis = client.readTimeoutMillis,
        writeTimeoutMillis = client.writeTimeoutMillis
    )

    var calledNoMoreExchanges = false
    try {
      // 开始执行
      val response = chain.proceed(originalRequest)
      if (isCanceled()) {
        response.closeQuietly()
        throw IOException("Canceled")
      }
      return response
    } catch (e: IOException) {
      calledNoMoreExchanges = true
      throw noMoreExchanges(e) as Throwable
    } finally {
      if (!calledNoMoreExchanges) {
        noMoreExchanges(null)
      }
    }
  }
```

在`getResponseWithInterceptorChain`中，添加了一个集合将用户自定义的拦截器以及默认的拦截器整合起来，然后以`RealInterceptorChain`来将所有的拦截器以责任链模式进行组合执行。

``` kotlin
// RealInterceptorChain.kt

@Throws(IOException::class)
  override fun proceed(request: Request): Response {
    ...
    
    // 创建下一个RealInterceptorChain，下标后移一位
    val next = copy(index = index + 1, request = request)
    // 取出当前对应下标的拦截器，并执行
    val interceptor = interceptors[index]
    val response = interceptor.intercept(next) ?: throw NullPointerException(
        "interceptor $interceptor returned null")

    ...
    return response
  }
}
```

在每个`RealInterceptorChain`中，都会传递一个index下标用来标识当前的链节点应该执行哪个拦截器。在具体的`proceed`中，会去创建下一个`RealInterceptorChain`节点，并且在执行过程中将将其传递给拦截器。因此，我们在自定义拦截器中，必须要执行`chain.proceed`方法将链执行下去。



## 五大拦截器

在前面的`getResponseWithInterceptorChain`方法中，创建了一个链式执行方法，并添加了多个拦截器。如果去除自定义的拦截器外，还有五个拦截器。这是默认的拦截器，也是`OkHttp`的核心，通过这五个拦截器最终实现的网络请求。

### RetryAndFollowUpInterceptor

重试和重定向拦截器，
