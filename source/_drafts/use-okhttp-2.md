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

重试和重定向拦截器。正常来说，我们的网络请求肯定会因为各种网络问题导致请求失败或者链接被重定向，该拦截器就是用于处理这种情况的，当请求发生错误或者被重定向后，该拦截器会直接再次发起请求进行重试，并且将重试次数设定为最多20次。

```kotlin
@Throws(IOException::class)
override fun intercept(chain: Interceptor.Chain): Response {
    val realChain = chain as RealInterceptorChain
    ...
    // 循环请求，直到退出
    while (true) {
        try {
          ...
          try {
            // 直接交给下一个拦截器去进行网络请求
            response = realChain.proceed(request)
          } catch (e: RouteException) {
            // 发生异常代表请求失败，continue重新下一次请求
            continue
          } catch (e: IOException) {
            continue
          }

          // 请求成功，然后去判断response的状态码是否是重定向状态码，是的话重新生成request，否则返回null
          val followUp = followUpRequest(response, exchange)

          if (followUp == null) {
            // 非重定向，请求成功
            return response
          }
          // 最大重试次数20次
          if (++followUpCount > MAX_FOLLOW_UPS) {
            throw ProtocolException("Too many follow-up requests: $followUpCount")
          }
          request = followUp
          priorResponse = response
        }
    }
}
```

### BridgeInterceptor

桥接拦截器。`OkHttp`的整个拦截器链是逐渐深入的，越往后拦截器执行的操作越偏底层。前面的重试和重定向拦截器负责的是整个网络请求的执行，用于异常时重新发起请求。接下来的`BridgeInterceptor`拦截器则是处理网络请求的`head`的处理和数据压缩处理，毕竟我们对于网络请求的速度还是有要求的，而gzip压缩方式在HTTP中应用的最广泛，`BridgeInterceptor`就用于添加`gzip`的`head`，并处理将压缩数据进行解压。

```kotlin
@Throws(IOException::class)
  override fun intercept(chain: Interceptor.Chain): Response {
    val userRequest = chain.request()
    val requestBuilder = userRequest.newBuilder()

    val body = userRequest.body
    if (body != null) {
      val contentType = body.contentType()
      if (contentType != null) {
        requestBuilder.header("Content-Type", contentType.toString())
      }
      val contentLength = body.contentLength()
      if (contentLength != -1L) {
        requestBuilder.header("Content-Length", contentLength.toString())
        requestBuilder.removeHeader("Transfer-Encoding")
      } else {
        requestBuilder.header("Transfer-Encoding", "chunked")
        requestBuilder.removeHeader("Content-Length")
      }
    }
    if (userRequest.header("Host") == null) {
      requestBuilder.header("Host", userRequest.url.toHostHeader())
    }
    // OkHttp是有一个连接池的，用于管理复用各个连接，避免每次请求都创建而浪费资源
    if (userRequest.header("Connection") == null) {
      requestBuilder.header("Connection", "Keep-Alive")
    }

    // 如果没有自己添加编码格式的话，则添加gzip的header，告诉服务端我们支持gzip压缩
    var transparentGzip = false
    if (userRequest.header("Accept-Encoding") == null && userRequest.header("Range") == null) {
      transparentGzip = true
      requestBuilder.header("Accept-Encoding", "gzip")
    }
    // 加载cookie
    val cookies = cookieJar.loadForRequest(userRequest.url)
    if (cookies.isNotEmpty()) {
      requestBuilder.header("Cookie", cookieHeader(cookies))
    }
    // User-Agent是OkHttp
    if (userRequest.header("User-Agent") == null) {
      requestBuilder.header("User-Agent", userAgent)
    }

    // 交给下一个拦截器执行网络请求
    val networkResponse = chain.proceed(requestBuilder.build())
    // 请求结束后保存cookie
    cookieJar.receiveHeaders(userRequest.url, networkResponse.headers)

    val responseBuilder = networkResponse.newBuilder()
        .request(userRequest)
    // 根据服务端返回的header判断是否使用gzip压缩了，并将数据进行解压然后设置成原始数据的body
    if (transparentGzip &&
        "gzip".equals(networkResponse.header("Content-Encoding"), ignoreCase = true) &&
        networkResponse.promisesBody()) {
      val responseBody = networkResponse.body
      if (responseBody != null) {
        val gzipSource = GzipSource(responseBody.source())
        val strippedHeaders = networkResponse.headers.newBuilder()
            .removeAll("Content-Encoding")
            .removeAll("Content-Length")
            .build()
        responseBuilder.headers(strippedHeaders)
        val contentType = networkResponse.header("Content-Type")
        responseBuilder.body(RealResponseBody(contentType, -1L, gzipSource.buffer()))
      }
    }

    return responseBuilder.build()
  }
```

从代码上面的注释可以看到，`BridgeInterceptor`主要的责任是在请求前添加各种`header`和`cookie`和`gzip`的支持，请求后保存`cookie`和解析`gzip`的数据。

### CacheInterceptor

缓存拦截器。在各种请求方式中，GET和HEAD是最不涉及状态的，GET通常用来请求列表等数据，而HEAD通常只返回header头数据，用于判断数据是否有更新，因此这两种方式是可以被缓存的，如果请求的数据未发生变化的话，则直接从缓存中取出结果而不是发起一个实际的请求，`CacheInterceptor`中，使用了`LruCache`存储了请求的结果。

```kotlin
@Throws(IOException::class)
  override fun intercept(chain: Interceptor.Chain): Response {
    val call = chain.call()
    // 从缓存中获取response
    val cacheCandidate = cache?.get(chain.request())

    val now = System.currentTimeMillis()
    // 计算缓存的response是否还是有效的
    val strategy = CacheStrategy.Factory(now, chain.request(), cacheCandidate).compute()
    val networkRequest = strategy.networkRequest
    val cacheResponse = strategy.cacheResponse


    // 只允许从缓存中获取，但是又没有缓存，直接返回一个错误
    if (networkRequest == null && cacheResponse == null) {
      return Response.Builder()
          .request(chain.request())
          .protocol(Protocol.HTTP_1_1)
          .code(HTTP_GATEWAY_TIMEOUT)
          .message("Unsatisfiable Request (only-if-cached)")
          .body(EMPTY_RESPONSE)
          .sentRequestAtMillis(-1L)
          .receivedResponseAtMillis(System.currentTimeMillis())
          .build().also {
            listener.satisfactionFailure(call, it)
          }
    }

    // 不需要网络request，说明有缓存，直接返回
    if (networkRequest == null) {
      return cacheResponse!!.newBuilder()
          .cacheResponse(stripBody(cacheResponse))
          .build().also {
            listener.cacheHit(call, it)
          }
    }

    // 都没有，交给下一个拦截器去进行网络请求
    var networkResponse: Response? = null
    try {
      networkResponse = chain.proceed(networkRequest)
    } finally {
    }

    // 有缓存，并且状态码是304，则更新下缓存数据并直接返回
    if (cacheResponse != null) {
      if (networkResponse?.code == HTTP_NOT_MODIFIED) {
        val response = cacheResponse.newBuilder()
            .headers(combine(cacheResponse.headers, networkResponse.headers))
            .sentRequestAtMillis(networkResponse.sentRequestAtMillis)
            .receivedResponseAtMillis(networkResponse.receivedResponseAtMillis)
            .cacheResponse(stripBody(cacheResponse))
            .networkResponse(stripBody(networkResponse))
        cache.update(cacheResponse, response)
        return response
      } else {
        cacheResponse.body?.closeQuietly()
      }
    }

    val response = networkResponse!!.newBuilder()
        .cacheResponse(stripBody(cacheResponse))
        .networkResponse(stripBody(networkResponse))
        .build()

    if (cache != null) {
      // 添加新缓存
      if (response.promisesBody() && CacheStrategy.isCacheable(response, networkRequest)) {
        val cacheRequest = cache.put(response)
        return cacheWritingResponse(cacheRequest, response)
      }
      // POST、PATCH、PUT、DELETE、MOVE等请求方式不允许缓存，直接移除缓存
      if (HttpMethod.invalidatesCache(networkRequest.method)) {
        try {
          cache.remove(networkRequest)
        } catch (_: IOException) {
          // The cache cannot be written.
        }
      }
    }
    return response
  }
```

缓存拦截器从本地缓存中获取缓存，如果取到了缓存并且是有效期限内的，则直接返回，此时不会发生网络请求；如果未取到，则会交给下一个拦截器去进行网络请求，并将请求结果缓存在本地。因此从这里看，在五大拦截器中，前三个拦截器执行的时候，是可能并没有发生实际的网络请求的。

在`OkHttpClient`的创建时，我们能添加两种拦截器，一种是`addInterceptor`一种是`addNetworkInterceptor`。从名字也可以看到一个是普通拦截器，一个是网络拦截器，执行顺序则是普通拦截器是第一顺序执行的，网络拦截器是在`CacheInterceptor`后执行的。差别就是普通拦截器会在每次请求的时候都会触发执行，而网络拦截器则只有真正发生网络请求的时候才会去执行。

### ConnectionInterceptor

```kotlin
object ConnectInterceptor : Interceptor {
  @Throws(IOException::class)
  override fun intercept(chain: Interceptor.Chain): Response {
    val realChain = chain as RealInterceptorChain
    // 交换对象，会根据request来创建或者从连接池中查找连接
    // 并创建HTTP1或者HTTP2的编解码器，用于实际进行输入HTTP命令
    val exchange = realChain.call.initExchange(chain)
    // 交给下一个拦截器处理
    val connectedChain = realChain.copy(exchange = exchange)
    return connectedChain.proceed(realChain.request)
  }
}
```

`ConnectionInterceptor`代码行数较少，实际操作都在其他类中了。它被设计成单例模式，其主要工作就是创建或者复用已有的`HTTP`连接，并创建对应的`Codec`用于解析`HTTP1`或者`HTTP2`。

### CallServerInterceptor

