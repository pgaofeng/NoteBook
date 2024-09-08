---
title: Android进程间通信-AIDL
date: 2021-03-12 12:09:40
categories: Android Framework
tags:
 - Binder
 - AIDL
banner_img: img/cover/cover-aidl.webp
---

`Android`进程间通信通常使用的`Binder`的方式，而`Binder`则是以`C/S`模式实现的，即`Binder`的主体作为服务端提供服务，`Binder`的引用端作为客户端请求服务。但是`Binder`是在`Framework`层使用`C++`实现的，为了方便`Android应用端`的开发，对`Native`层的`Binder`进行包装实现了`Java`层的`Binder`，并又进一步提供了`AIDL`的实现方式来简化进程间调用，这就是本篇文章所记录的内容。

## Binder的媒介

作为`C/S`架构的实现，`Binder`需要客户端和服务端。服务端也就是`Binder`的主体，需要注册在`ServiceManager`中；客户端会通过`Binder`的名字获取到对应`Binder`的代理，然后就可以进行通信了。但是在应用层开发中，我们肯定不能直接注册`Binder`的，因此需要匿名`Binder`的实现，而匿名`Binder`应用最广泛的就是四大组件的`Service`了。

```kotlin
class ServerService : Service() {
    override fun onBind(intent: Intent?): IBinder? {
        // 在这里返回Binder实体作为服务端
    }
}
```

通过`bindService`方式启动的服务，可以实现`onBind`方法来返回`Binder`实体作为服务端对象。当服务被绑定后，该`Service`进程会被拉起来，此时该`Service`进程就是服务端了。绑定者所在的进程会拿到`IBinder`的代理对象，然后两个进程就通过`IBinder`来进行进程间的交互。

## 服务端

前面说了`Binder`获取的方式，后面则是`Binder`的实现了。为了简化`Binder`的实现，`Android`提供了`AIDL`的方式来封装各种Binder通用的操作，让开发者仅需关注具体的业务功能即可。

```kotlin
plugins {
    ...
}

android {
    ...
    buildFeatures {
        aidl = true
    }
}

dependencies {
  ...
}
```

首先需要在`build.gradle.kts`中开启`AIDL`的支持，即在`android`闭包下新增`buildFeatures`闭包，然后声明`aidl=true`，`groovy`语法也是一样的。然后在源码的同级目录下新增`aidl`目录`app\src\main\aidl`，该目录就是存放`AIDL`文件的目录。

如果直接通过`右键-new-AIDL-new aidlFile`创建`AIDL`文件的话，会在`aidl`目录下生成一个和当前应用同样的包名目录，然后新的`AIDL`文件则是在这个目录下。实际上，这个包名是不必和应用的包名一致的，可以随意定义。`AIDL`文件不会有任何`IDE`提示的，需要我们完全手写。

```aidl
app\src\main\aidl\com\server\aidl\IServer.aidl

package com.server.aidl;

interface IServer {
    // 定义了一个方法，服务端提供文本
    String getTextFromServer();
}
```

接下来需要点击AS的`build -> make project`触发文件的生成，AS会根据`AIDL`文件去生成对应的Binder类，然后我们继承该类即可。生成的文件在`app\build\generated\aidl_source_output_dir\debug\out\com\server\aidl\IServer.java`中，当然我们不需要关注他在哪，我们直接使用即可。新建一个类继承`IServer.Stub`，然后实现方法即可。如果提示找不到这个类的话，尝试`clean`一下再重新`build`。

```kotlin
/**
 * Binder的实体，作为服务端使用，继承IServer.Stub后只需要关注需要实现的方法即可
 */
class Server : IServer.Stub(){

    override fun getTextFromServer(): String {
        return "我是服务端返回的文本"
    }
}
```

然后在Service中的onBind将该对象返回即可。

```kotlin
class ServerService : Service() {
    override fun onBind(intent: Intent?): IBinder? {
        return Server()
    }
}
```

注意在`manifest`中声明时，`exported`属性必须设置成`true`并且定义`intent-filter`，因为我们是要在另一个app中绑定该服务的。另外，在`exported`设为`true`后，还需要通过权限进行控制，这里偷懒就不加权限了。

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    <application>
        <service
            android:name=".ServerService"
            android:exported="true">
            <intent-filter>
                <action android:name="com.example.server.action" />
            </intent-filter>
        </service>
    </application>
</manifest>
```

至此，服务端所做的工作已经完成了。总结下来就是创建一个`aidl`文件并声明所支持的接口方 法，然后`build`生成对应的类，然后再继承生成的`xxx.Stub`类实现支持的接口方法即可。

## 客户端

客户端要做的工作更简单了，首先创建一个新的项目，然后在`build.gradle.kts`中开启`aidl`的支持，然后将服务端创建的`aidl`复制到客户端的目录下。注意：**复制过来的`AIDL`文件的包名必须和服务端保持一致**。然后Build一下生成具体的代码。

接下来就是在客户端中绑定服务端的Service，然后拿到`IBinder`对象，然后就可以进行交互了。

```kotlin
class MainActivity : AppCompatActivity() {

    private lateinit var mBtnRequest: Button
    private lateinit var mTextView: TextView
    private var mServer: IServer? = null

    private val mConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            // 绑定服务后拿到IServer，后续就通过IServer进行进程间交互
            mServer = IServer.Stub.asInterface(service)
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            mServer = null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }
        init()
    }

    private fun init() {
        mBtnRequest = findViewById(R.id.btn_request)
        mTextView = findViewById(R.id.text)
        mBtnRequest.setOnClickListener {
            // 点击后通过IServer获取到服务端返回的字串
            mTextView.text = mServer?.textFromServer ?: "default"
        }
        val intent = Intent().also {
            // 服务端Service的action
            it.action = "com.example.server.action"
            // 服务端Service所在的app的包名
            it.`package` = "com.example.serverdemo"
        }
        bindService(intent, mConnection, BIND_AUTO_CREATE)
    }

    override fun onDestroy() {
        super.onDestroy()
        unbindService(mConnection)
    }

}
```

服务端很简单，在`Activity`启动时绑定服务端的服务，然后拿到`IBinder`通过生成的`IServer.Stub.asInterface`转换成`IServer`，然后就可以直接进行交互了。因为我们是在客户端app中绑定服务端app的，在`Android 11`以后需要在`Manifest`中声明要绑的包名，否则无法绑定成功。

```xml
<manifest
    <!-- 必须声明服务端的包名 -->
    <queries>
        <package android:name="com.example.serverdemo"/>
    </queries>
    
    <application
    </application>

</manifest>
```

## AIDL支持的类型

前面的示例说明了`AIDL`的交互方式，从代码层面上看，在客户端拿到`IServer`后，可以直接调用方法进行交互，即以同步的方式进行跨进程的调用。既然实际是跨进程调用的，那么实现上肯定是有一些限制的。如参数的类型，就不是全部类型都能使用的。

### 默认数据类型

基本数据类型：`byte`, `char`, `int`, `long`, `float`, `double`, `boolean`， 以及基本类型对应的数组

字串类型：`CharSequence`, `String`， 以及字串类型对应的数组

集合类型：`List`, `Map`,  最新的版本中集合类型已经不局限于`ArrayList`和`HashMap`了

除了以上类型外，如果想要传递自定义的类型，则需要实现`Parcelable`接口。

### 手动定义Parcelable

首先在代码目录中创建一个`User`类，然后实现`Parcelable`接口：

```kotlin
// 注意包名！
package com.example.server

import android.os.Parcel
import android.os.Parcelable

data class User(
    val name:String,
    val age:Int
):Parcelable {
    constructor(parcel: Parcel) : this(
        parcel.readString().toString(),
        parcel.readInt()
    ) {
    }

    override fun writeToParcel(parcel: Parcel, flags: Int) {
        parcel.writeString(name)
        parcel.writeInt(age)
    }

    override fun describeContents(): Int {
        return 0
    }

    companion object CREATOR : Parcelable.Creator<User> {
        override fun createFromParcel(parcel: Parcel): User {
            return User(parcel)
        }

        override fun newArray(size: Int): Array<User?> {
            return arrayOfNulls(size)
        }
    }
}
```

然后在aidl目录中新建一个`User.aidl`，**注意该文件的包名必须和`User`类的包名保持一致**：

```java
// User.aidl

package com.example.server;
parcelable User;
```

然后实际使用的地方也需要进行**导包**，注意as不会提示导包，必须要手动输入：

```java
package com.server.aidl;
// 必须进行import!!
import com.example.okhttpdemo3.User;
interface IServer {
    String getTextFromServer();
    void otherTypes(
        in User user
    );
}
```

### 自动生成Parcelable

前面手动生成`Parcelable`的地方，`User`类定义在了代码目录中，因此当复制`aidl`文件到客户端的时候，必须要把`User`类的文件也同时复制过去，并且包名路径要完全一致，这无疑是很麻烦的。因此可以使用`aidl`自动生成`Parcelable`的方式来实现`User`类。

1，删除前面定义的`User`类文件

2，修改`User.aidl`内容

```java
// User.aidl

package com.example.server;
parcelable User {
   int age;
   String name;
}
```

这样`build`之后会自动生成一个`User`类，不需要再写那些复杂的逻辑了。

### 属性修饰符

在前面的自定义`Parcelable`时，可以看到在`AIDL`使用自定义`Parcelable`类型的时候，加上了属性修饰符`in`。实际上，除了`byte`, `char`, `int`, `long`, `float`, `double`, `boolean`, `CharSequence`, `String`外，其他的类型作为参数时都必须添加属性修饰符。

#### in

数据从客户端传递到服务端，也是最常用的调用方式。也就是数据作为参数从客户端传入，可以理解为值传递，就是在服务端对这个参数进行修改的话，是影响不到客户端的。

```java
package com.server.aidl;
// 必须进行import!!
import com.example.okhttpdemo3.User;
interface IServer {
    String getTextFromServer();
    void otherTypes(
        // 定义成in类型
        in User user
    );
}
```

```kotlin
// 服务端的Binder实体
class Server : IServer.Stub() {
    private val TAG = "Server"
    override fun getTextFromServer(): String {
        return "服务端返回的字串"
    }

    override fun otherType(user: User?) {
        Log.d(TAG, "user.name = ${user?.name}, user.age = ${user?.age}")
        // 在服务端将传递的参数的值变化下
        user?.age = 80
    }
}

// 客户端调用
mBtnRequest.setOnClickListener {
    val user = User().also {
        it.name = "张三"
        it.age = 23
    }
    mServer?.otherType(user)
     Log.d(TAG, "after call, name = ${user.name}, age = ${user.age}")
}
```

打印的结果值如下，可以看到即使在服务端修改了`User`的字段，实际上客户端的`User`仍没有发生变化：

```
com.example.serverdemo    D  user.name = 张三, user.age = 23
com.example.clientdemo    D  after call, name = 张三, age = 23
```

#### out

数据由服务端流向客户端，这种方式服务端无法获取到`User`的数据，但是对`User`的修改却能反馈到客户端中去。将前面`aidl`文件中的`in`修改为`out`后，在分别`build`并运行后，输入的`log`如下：

```
com.example.serverdemo    D  user.name = null, user.age = 0
com.example.clientdemo    D  after call, name = null, age = 80
```

可以看到，在客户端实际传入的是一个有内容的User，但是在服务端中是无法读取到User的内容的。但是在服务端修改User后，客户端的User也修改了，并且客户端的原始内容被清空了。因此，out修饰符就是提供一个对象，用于接收服务端对该对象的修改。

#### inout

数据双向流通，即服务端能获取到客户端传入的内容，客户端也能收到服务端对该内容的修改。将前面`aidl`文件中的`in`修改为`out`后，在分别`build`并运行后，输入的`log`如下：

```
com.example.serverdemo    D  user.name = 张三, user.age = 23
com.example.clientdemo    D  after call, name = 张三, age = 80
```

可以看到，服务端能读取到User的内容，并且对User内容的修改也能反馈到客户端。这种修饰符修饰下，对跨进程调用的方法，表现形式是和本进程内的调用java方法一样的。

## 总结

`AIDL`是`Android`提供的跨进程调用的工具，实际上`AIDL`文件是不会被打包到app中的，只是根据其内容来生成代码文件，将跨进程那一套通用的逻辑都自动生成了，方便我们只关注业务逻辑部分。从使用上来说，`AIDL`一般在系统应用中才用的比较多，因为很多系统应用间都需要互相交互，使用`AIDL`无疑是非常方便的。而对于普通应用，一般是大体量的app会将本身分成多个进程，然后去使用`AIDL`实现进程间交互。
