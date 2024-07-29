---
title: OkHttp3的简单使用
date: 2021-01-27 21:15:58
tags:
 - OkHttp
categories: Third Libraries
banner_img: img/cover/cover-okhttp.webp
series: okhttp3
---



`OkHttp`是目前最流行的网络请求框架，几乎现在的`Android`开发中都是使用`OkHttp`来进行网络请求的，搭配`Retrofit`使用的话更方便了。本篇文章即是记录`OkHttp`的一些基本使用方式，方便以后回忆和查询。

## 引入依赖

```groovy
// 统一管理OkHttp版本
implementation(platform("com.squareup.okhttp3:okhttp-bom:4.12.0"))
// OkHttp
implementation("com.squareup.okhttp3:okhttp")
// log打印，方便查看网络请求的内容
implementation("com.squareup.okhttp3:logging-interceptor")
```

这里同时引入了`OkHttp`和`Logging`库，因此使用了`okhttp-bom`去统一管理依赖版本。正常情况下只需要引入`implementation("com.squareup.okhttp3:okhttp:4.12.0")`即可。另外就是需要加上网络权限。

```xml
<uses-permission android:name="android.permission.INTERNET"/>
```



## 简单的网络请求

```kotlin
private fun request() {
    val request = Request.Builder()
        .url("https://www.wanandroid.com/banner/json")
        .build()
    thread {
        val client = OkHttpClient()
        val call = client.newCall(request)
        val response = call.execute()
        Log.d(TAG, "code = ${response.code}, message = ${response.body?.string()}")
    }
}
```

首先创建一个`Request`对象，这是请求的主体，整个请求的参数以及方式等都是由`Request`去声明的。然后开了一个线程进行网络请求，因为`OkHttp`是禁止在主线程中进行同步方式的网络请求，因为请求过程是一个耗时操作，会阻塞主线程。然后就是创建了一个`OkHttpClient`，它是网络请求的一个工厂类转换类。请求的对象`Request`会被`OkHttpClient`转换成不同的`Call`的实现类，最终由Call以同步或者异步的方式来执行网络请求。

## OkHttpClient

在上面的简单的网络请求实例中可以看到，`OkHttpClient`用来处理`Request`请求的。实际上它是一个通用的配置类，可以用来配置整个网络请求的属性。如缓存、连接池、线程池、`Cookie`等等，因此在开发中应该将其设计成单例的形式供各个功能模块进行调用。

`OkHttpClient`采用了`Builder`模式设计，可以进行各种自定义的操作设置。实际上各种默认的设置已经能够满足大部分的需求了，需要自定义的部分反而不多，更多的是添加`Interceptor`。如我们上面的加的`Logging`的依赖即是一个拦截器，可以添加在`OkHttpClient`中用于请求参数的打印。

```kotlin
val mOkHttpClient = OkHttpClient.Builder()
    .addInterceptor(HttpLoggingInterceptor().also { 
        it.level = HttpLoggingInterceptor.Level.BODY 
    })
.build()
```

由于默认的`Logging`的`Level`是`NONE`，什么都不会输出，因此需要将其设置为其他可输出的级别，这里设置的是`BODY`级别，会输出所有的请求内容。

## Request

`Request`是用来构建网络请求的，采用的Builder模式来构建一个请求，默认是`GET`的请求方式。对于常用的HTTP请求方法都是支持的，如`GET`、`POST`、`HEAD`、`PUT`等。

```kotlin
val request = Request.Builder()
    .url("https://www.wanandroid.com/banner/json")
    .get() // 采用GET方式，默认方式。可以不用调用这个方法
    .build()
```

`GET`的请求方式比较简单，需要传递参数的话也是直接通过`url`中拼接参数。而`POST`通常不会在url中拼接参数，而是使用别的方式。对应在`Request`中，当选择`POST`方式时，必须传递一个非空的`RequestBody`参数用于存放请求参数。常用的如表单类型：则需要传递的是`FormBody`。

```kotlin
val request = Request.Builder()
    .url("https://www.wanandroid.com/user/login")
    .post(
        FormBody.Builder()
            .add("username", "rmfone")
            .add("password", "*****")
            .build()
    )
    .build()
```

简单表单格式，会在请求头中添加`Content-Type: application/x-www-form-urlencoded`。这种类型通常都是基础的字符串参数，如果想要传递文件等信息的话，则需要用到`MultipartBody`，可以支持各种参数类型。

```kotlin
val request = Request.Builder()
    .url("https://www.wanandroid.com/user/login")
    .post(
        MultipartBody.Builder()
            .addPart(
                FormBody.Builder()
                    .add("username", "rmfone")
                    .add("password", "*****")
                    .build()
            )
            .addFormDataPart("2.jpg", file.name, file.asRequestBody())
            .build()
    )
    .build()
```

`MultipartBody`实际产生的内容类型是混合类型，`Content-Type: multipart/mixed; boundary=d721ad8b-8e88-4fcf-b370-91b2a43aa50c`，会将请求内容分为多个部分，每个部分使用`boundary`的值来进行区分。上面的实例中，添加了一个表单类型的部分和一个文件内容的部分。至于其他的请求方式如`PUT`、`HEAD`等，与上面的也是一样的。

## Call

Call是网络请求中的进一步实现，具体的实现是`RealCall`，最终的请求即是由Call发起的。它有两种请求方式，同步方式和异步方式。注意不要在主线程中调用同步方式的请求。

```kotlin
// 同步方式，注意不要在主线程调用
val response = call.execute()
// 异步方式
call.enqueue(object : Callback{
    override fun onFailure(call: Call, e: IOException) {
        e.printStackTrace()
    }
    override fun onResponse(call: Call, response: Response) {
        Log.d(TAG, "code = ${response.code}, msg = ${response.body?.string()}")
    }
})
```

## Response

`Response`是网络请求的结果，可以通过`code`获取结果码来判断请求是否成功，然后通过`Response.body`获取到请求结果。正常来说直接通过`body.string()`即可获取到此次的请求结果。当然，如果是下载的话，则可以通过`body.byteStream()`获取到此次连接的数据流，然后通过读取`stream`来实现下载和计算进度。



 ## Interceptor

OkHttp的整体网络请求是使用的责任链模式实现的，主体是五大拦截器，逐渐细化对网络请求参数的拆解、封装、压缩、传输等。在此基础上，也允许我们添加自定义的拦截器去参与到网络请求的过程中。如前面引入的`HttpLoggingInterceptor`就是一个用于打印请求参数和结果的拦截器。

```kotlin
private val mOkHttpClient = OkHttpClient.Builder()
    .addInterceptor(HttpLoggingInterceptor().also {
        it.level = HttpLoggingInterceptor.Level.BODY
    })
    .build()
```

拦截器主要是在`OkHttpClient`构建的时候添加进去的，我们在正常使用的时候，传入自定义的`Interceptor`参数，然后在`intercept`方法中去处理自己的逻辑。如我们想在每次请求前和请求后打印出`HEAD`信息 ：

```kotlin
private val mOkHttpClient = OkHttpClient.Builder()
    .addInterceptor { chain ->
        // 网络请求前
        val request = chain.request()
        Log.d(TAG, "before network: ${request.headers}")
        // 交给下一个拦截器处理，最终会实际请求
        val response = chain.proceed(request)
        //网络请求之后
        Log.d(TAG, "after network: ${response.headers}")
        response
    }
    .build()
```

## 总结

网络请求无非是建立连接，发送请求，处理响应三个步骤。对于我们使用来说，只需要关注发送请求和处理响应即可。发送请求主要是构建`Request`，通过`Request`的构建时调用的不同方法去选择使用什么方式进行请求，以及参数的传入、`HEAD`的添加等。而像`Cookie`的添加，则是在构建`OkHttpClient`的时候传入的`CookieJar`来管理`Cookie`。每次请求的时候，都会根据`url`从`CookieJar`中取出对应的`Cookie`写入到请求头中，然后在收到响应后将响应头中的`Cookie`存储到`CookieJar`。

响应则更简单，主要是从`Response`中取出数据。可以从`Response`中获取到状态码来判断网络请求是否成功，最主要的是获取`body`信息，这是一次网络请求的主体，通常是使用`Json`格式的数据，然后我们将其序列化成对象进行使用即可，其余皆不需要关注。

由于`OkHttp`良好的封装和设计模式的应用，使得我们在使用的时候异常简单，几乎不需要什么学习成本即可完成网络请求。这么好的库不学习一番太过浪费了，后面将对`OkHttp`的源码进行分析，剖析它的设计之美。

