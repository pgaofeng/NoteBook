---
update-data: 2023-12-27 19:50:15 +0800
title: 好用的依赖注入框架-Hilt
date: 2021-06-06 20:56:48
categories: 
  - Android
  - Hilt
tags: 
  - Jetpack
  - 三方库
---

![img](/img/cover-hilt.webp)

### 为什么使用依赖注入

要学习某个框架，必须要弄明白它是用来干嘛的，有什么好处。 那么`Hilt`是什么呢，它有什么好处呢？

首先，`Hilt`是一个依赖注入框架。依赖就是一个对象的功能依赖于其他对象去实现。就比如我们要上网，那我们就依赖于手机或者电脑，而在项目中，`ViewModel`想要获取数据就依赖于数据仓库`Repository`。我们依赖于某个东西的功能去实现自己的需求，这就是依赖。

而想要使用某个对象的功能，通常是直接`new`一个对象出来然后使用它的功能即可。但是这样的话，当依赖的对象很多的话，会导致类本身非常臃肿。因为要保持对每个依赖对象的创建和维护，而我们仅仅是想要使用它的功能而已，对于其他的并不关心。因此可以提供一个方法`setXXX`，这样类本身并不去创建维护对象，而是交给外部去管理并传递进来，这就是注入。

将依赖对象的创建交给了外部去传递进来，那么这个外部又应该是谁呢？发现这个过程交给谁都不太合适，因此就单独创建一个容器去创建管理，这个容器就是依赖注入框架，也就是本章说的`Hilt`。


#### 添加Hilt依赖

首先在项目的`build.gradle`中加入如下代码：


```groovy
buildscript {
    ext.hilt_version = "2.36"
    ...
    dependencies {
        ...
        classpath "com.google.dagger:hilt-android-gradle-plugin:$hilt_version"
    }
}
...

```
然后在要使用Hilt的`module`的`build.gradle`中加入：

```groovy
plugins {
    ...
    id 'kotlin-kapt'
    id 'dagger.hilt.android.plugin'
}

android {
    ...
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
    ...
}

dependencies {
    ...
    implementation "com.google.dagger:hilt-android:$hilt_version"
    kapt "com.google.dagger:hilt-android-compiler:$hilt_version"
}

```

#### 前置工作

要使用Hilt，首先要对`Application`进行处理，使用`@HiltAndroidApp`去注解`Application`。这是必须要做的，使用这个注解后，Hilt才会去生成一系列的容器组件，这时候才能够使用Hilt。

```kotlin
// App.kt
@HiltAndroidApp
class App:Application()
```


```xml
// AndroidManifest.xml
<manifest>
    <application
        android:name=".App"
        ...>
    </application>
</manifest>
```

### 使用Hilt

#### @Inject标记注入
Hilt的注入是通过注解来进行标识的，要注入的对象使用`@Inject`注解即可。同样的，要注入的对象的构造方法也要使用`@Inject`注解，如下例。


```kotlin
// Person.kt
class Person @Inject constructor() {
    fun say() {
        println("Hello")
    }
}

// MainActivity.kt
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    @Inject
    lateinit var person: Person

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        person.say()
    }
}
```
在`MainActivity`中并没有直接给`person`赋值，而是使用了`@Inject`进行注解，然后就直接使用了，这是因为Hilt在背后给这个字段去初始化赋值了。为了能够让Hilt去生成一个Person对象进行注入，我们还要给Person的构造方法上也加上`@Inject`，这样就完成了一个最简单的依赖注入了。

#### @AndroidEntryPoint注入的入口点
还有一点就是在`MainActivity`上还使用了`@AndroidEntryPoint`，这个注解表示当前的`Activity`是一个注入的入口点，可以进行注入。Hilt并不是在哪都能进行注入的，而是有着特定的入口点，并且入口点必须得通过`@AndroidEntryPoint`注释。其中入口点有**6**个，`Application，Activity，Fragment，View，Service，BroadcastReceiver`。但是`Application`这个入口点不用使用`@AndroidEntryPoint`注解，因为它已经有了`@HiltAndroidApp`，所以可以直接注入。

```kotlin
// App.kt
@HiltAndroidApp
class App:Application() {
    @Inject
    lateinit var person: Person

    override fun onCreate() {
        super.onCreate()
        person.say()
    }
}
```
这几个入口点中，`View`和`Fragment`有些特殊，其他的入口点只要注解为`@AndroidEntryPoint`后，即可在其中进行Hilt的注入。但是对于Fragment而言，若是想在Fragment中使用Hilt的注入，除了在Fragment上使用@AndroidEntryPoint外，**还要在其宿主Activity上也加上这个注解**才行。而对于View而言，若是在View中使用Hilt的注入，首先在View上使用@AndroidEntryPoint，然后**若是View用在Activity上，则Activity上也要加该注解。若是View用在Fragment上，则Fragment和Fragment的宿主Activity都要加上这个注解**。

可以看到Hilt的使用是比较简单的，首先将类的构造方法使用`@Inject`注解，这表明该类可以被Hilt自动创建并注入到相应的地方，然后就是在入口点中使用@Inject进行注入即可。


#### @HiltViewModel 注入ViewModel
`ViewModel`的注入和普通对象一样，首先给构造方法加@Inject，但是比普通对象多出来的是还要在它上面加入`@HiltViewModel`。并且注入的地方**不能使用@Inject**，而是和普通的使用ViewModel保持一致，使用`ViewModelProvider`去获取ViewModel。

注意这里不能使用@Inject去注入ViewModel，否则获取到的ViewModel只是一个普通对象，它在Activity销毁的时候也会被回收，而无法做到如ViewModel那样的在配置改变的时候依旧保存下来。


```kotlin
// MainAcitivity.kt
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    private lateinit var viewModel: ViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        viewModel = ViewModelProvider(this)[MyViewModel::class.java]
        println(viewModel)
    }
}

// MyViewModel.kt
@HiltViewModel
class MyViewModel @Inject constructor() : ViewModel()
```

如是嫌弃`ViewModelProvider`方式获取的太麻烦，则可以使用`Activity-ktx`的获取方式：
```kotlin
// build.gradle中加入依赖
implementation 'androidx.activity:activity-ktx:1.2.3'


@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    private val  viewModel:MyViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
    }
}

// 若是想要在Fragment中也这样使用，需要加入Fragment-ktx的依赖：
implementation 'androidx.fragment:fragment-ktx:1.3.4'
```



对于无法在构造方法上加`@Inject`的类如系统类三方库中的类等，是不能直接进行注入的，要通过安装模块的方式去添加依赖。


#### @Module @InstallIn 声明一个模块

模块也就是`Module`，是一个类文件，它包含了很多的方法，这些方法就是用来提供注入对象的。

模块必须使用@Module来进行注解，说明当前类是一个Hilt模块，可以用来提供依赖。并且同时还要使用`@InstallIn`注解，该注解接收一个数组类型的参数，表示安装在哪个组件上。

组件代表着一个作用范围，安装在该组件上的模块所提供的依赖方法，只能在当前组件范围内才能进行注入。而且不同的组件对应着不同的生命周期，安装在它上面的模块只会在其生命周期内存在。


```kotlin
// NetModule.kt
@InstallIn(SingletonComponent::class)
@Module
object NetModule {

    @Provides
    fun provideRetrofit(): Retrofit {
        return Retrofit.Builder()
            .baseUrl("https://xxxx.com/")
            .build()
    }
}
```

如上例，就是声明了一个`NetModule`模块，用来提供`Retrofit`的依赖，并且安装在`SingletonComponent`组件上，`SingletonComponent`组件的作用范围是全局，因此在所有的地方都能使用该模块所提供依赖注入，也就是对Retrofit的注入。

在这个模块中，有个`@Provide`标注的方法，该注解表明这个方法是是用来提供依赖的。注意它的返回值是Retrofit，表明需要注入Retrofit实例的时候，就会通过这个方法去生成一个实例对象进行注入。在Module中，Module的类名，方法名都是随意定的，Hilt只关心返回值。下面就是可以直接在Activity中注入Retrofit了：


```kotlin
// MainActivity.kt
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    @Inject
    lateinit var retrofit: Retrofit

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        println(retrofit.hashCode())
    }
}
```

#### 组件Component
当声明一个module的时候，必须要安装在组件上，这代表当前module可以给哪些类进行注入。在Hilt中，一共有**八**种组件，下面将逐一介绍组件的生命周期和作用范围。

##### SingletonComponent

`SingletonComponent`是针对`Application`的组件，安装在它上面的module会与Application的生命周期保持一致，在`Application#onCreate`的时候创建，在`Application#onDestroy`的时候销毁。并且该module所提供的依赖，**在整个程序中都是可以使用的。**

下面声明了两个模块，都是安装在`SingletonComponent`上的，但是一个是普通类，一个是单例类：

```kotlin
@Module
@InstallIn(SingletonComponent::class)
class NormalModule {...}

@Module
@InstallIn(SingletonComponent::class)
object SingletonModule {...}
```

这两种类型的模块有什么区别呢？使用`class`关键字的类是一个普通对象，因此会存在创建和销毁。它存在的范围也就是前面所说的组件的生命周期。例如在`SingletonSomponent`组件上，会在`Application#onCreate`的时候去`new`出一个`NormalModule`的实例对象，在`Application#onDestroy`的时候回收这个对象。

注意他是每个组件都会生成一个Module对象实例，例如若是这个module安装在`ActivityComponent`上的时候，会在每个`Activity#onCreate`的时候去创建一个module实例，也就是说，*每个Activity对应的module都是独立的对象*。

而使用`object`关键字的话，声明出来的module是一个`单例对象`，因此不会存在创建销毁过程。提供依赖的时候，用的都是同一个单例对象。


##### ActivityRetainedComponent

`ActivityRetainedComponent`是针对`Activity`的组件，因此它的生命周期是`Activity#onCreate`到`Activity#onDestroy`，但是它又比这个范围长一些。也就是当配置更改的时候，如旋转屏幕导致的Activity重建的时候，该组件并不会销毁，而是真正结束一个Activity的时候才会去销毁。简单来说就是生命周期与`ViewModel`是一致的。

安装在`ActivityRetainedComponent`组件上的module提供的依赖，**可以在ViewModel中，Activity中，Fragment中，以及View中注入。**


##### ActivityComponent

`ActivityComponent`组件的生命周期也是与Activity一致，但是，它是跟`Activity`完全一致的。只要Activity销毁，对应的组件也会销毁。

安装在`ActivityComponent`上的module提供的依赖，**可以在Activity中，Fragment中，以及View中注入**。

##### ViewModelComponent
`ViewModelComponent`组件和`ActivityRetainedComponent`是一样的，声明周期也是与`ViewModel`一致。唯一的区别是，安装在它上面的模块提供的依赖**只能在ViewModel中使用**。

##### FragmentComponent
`FragmentComponent`组件是针对于`Fragment`的，安装在它上面的组件在`Fragment#onAttach`的时候创建，在`Fragment#onDestroy`的时候销毁。

安装在它上面的module提供的依赖，**只能在Fragment中注用**。

##### ViewComponent

`ViewComponent`组件是针对于`View`的，在`View创建的时候`创建，在`视图销毁`的时候销毁。并且安装在它上面的module提供的依赖**只能在View中使用**。


##### ViewWithFragmentComponent
`ViewWithFragmentComponent`也是针对`View`的，但是注入的时候不仅要求在View上加入`@AndroidEntryPoint`，还要加上`@WithFragmentBindings`。安装在它上面的模块的生命周期也是与ViewComponent一样的。其中提供的依赖**只能用在View上**，*而且这个View还只能用在Fragment中，不能用在Activity中*。

##### ServiceComponent

`ServiceComponent`组件是针对`Service`的，依附于它的module在`Service#onCreate`的时候创建，在`Service#onDestroy`的时候销毁。并且安装在它上面的module**只能用在Service中**。


##### 七种组件的module生命周期以及使用范围，仅适用class关键字的module

| 组件 | module创建 | module销毁 | 可使用的入口点 |
| --- | --- | --- | ---|
| SingletonComponent | Application#onCreate | Application#onDestroy | 全部|
| ActivityRetainedComponent|Activity#onCreate|Activity#onDestroy|ViewModel,Activity,Fragment,View|
| ActivityComponent | Activity#onCreate | Activity#onDestroy | Activity,Fragment,View|
| ViewModelComponent| Activity#onCreate | Activity#onDestroy | ViewModel|
| FragmentComponent | Fragment#onAttach | Fragment#onDestroy | Fragment|
| ViewComponent     | View创建 | View销毁 | View|
| ViewWithFragmentComponent     | View创建 | View销毁 | View|
| ServiceComponent | Service#onCreate|Service#onDestroy|Service|


作用范围很好理解，是用来缩小注入的范围，以避免滥用注入。那么生命周期又有什么用呢？比如在`MainActivity`中有三个`Fragment`，这三个Fragment想要共享一个对象`Person`，那么该怎么实现呢？

第一种方法是定义在Activity中，然后通过Fragment拿到Activity，进而拿到这个Person对象。第二个方法是将Person对象放到Activity的ViewModel中，然后在Fragment中也去获取这个ViewModel，进而拿到Person对象。

最后一种方式就是利用Hilt生命周期的特性：


```kotlin
@Module
@InstallIn(ActivityComponent::class)
class ShareModule {
    private val person = Person()

    @Provides
    fun providePerson(): Person {
        return this.person
    }

}
```
首先我们知道，`ActivityComponent`上的module的在`Activity#onCreate`的时候创建，在`Activity#onDestroy`的时候销毁。因此它是与Activity对应的，而这个module提供的依赖是`ShareModule`中的内部对象。因此，只要Activity没有销毁，这个module也就是同一个对象，进而注入的依赖person也都是同一个对象，从而实现Fragment共享同一个对象。这时候只要在Fragment中这样使用就行了：

```kotlin
@AndroidEntryPoint
class MyFragment : Fragment(){
    @Inject
    lateinit var person: Person
    ...
}
```

###### 作用域

除了使用上述的方式可以实现在Activity的生命周期内共享某个依赖对象外，Hilt还提供了一个作用域的概念。在某个作用域内，提供的依赖对象也是唯一的，将上例中的ShareModule改造一下：


```kotlin
@Module
@InstallIn(ActivityComponent::class)
object ShareModule {

    @ActivityScoped
    @Provides
    fun providePerson(): Person {
        return Person()
    }

}
```

改造后的module也能实现和前面那样的效果，在Activity的生命周期内提供相同的`Person`对象。而只是简单的加了一个`@ActivityScoped`注解，这样，在Activity的生命周期范围内，拿到的依赖对象仍然是同一个，即使将module类使用`object`关键字声明成了单例类。

可以看到，使用作用域注解可以实现基于组件生命周期内提供单一对象的功能，这样的话，就可以直接将module定义为单例类就行了，若是`java`中的话定义成静态方法即可，这样可以用来避免频繁创建对象导致的开销。

另外注意一点就是，作用域注解必须与组件注解保持一致，比如在`ActivityComponent`只能使用`ActivityScoped`作用域，作用域注解的提供依赖的方法，在组件的生命周期内提供的是同一个依赖对象。


作用域注解不只是在module中使用，直接在类上面加上也是可以的，使用下面的代码也可以实现上述的效果：


```kotlin
@ActivityScoped
class Person @Inject constructor() {...}
```

###### 对应Component的作用域

| 组件 | 生命周期 | 生命周期 | 作用域 |
| --- | --- | --- | ---|
| SingletonComponent | Application#onCreate | Application#onDestroy | Singleton|
| ActivityRetainedComponent|Activity#onCreate|Activity#onDestroy|ActivityRetainedScope|
| ActivityComponent | Activity#onCreate | Activity#onDestroy | ActivityScoped|
| ViewModelComponent| Activity#onCreate | Activity#onDestroy | ViewModelScoped|
| FragmentComponent | Fragment#onAttach | Fragment#onDestroy | FragmentScoped|
| ViewComponent     | View创建 | View销毁 | ViewScoped|
| ViewWithFragmentComponent     | View创建 | View销毁 | ViewScoped|
| ServiceComponent | Service#onCreate|Service#onDestroy|ServiceScoped|


在定义模块的时候，使用`@InstallIn`可以限定当前模块安装在哪个组件上。其中`@InstallIn`的参数是个数组，也就是说，我们可以将这个模块安装在多个组件上。使用多个组件可以将作用范围进行扩大，比如使用`FragmentComponent`和`ServiceComponent`，就可以使模块中的依赖在`Fragment`和`Service`中使用了。但是，使用了多组件的话，因为组件的生命周期和作用范围不同，因此是**不能声明作用域注解的**。

当然若是两个组件的生命周期是一样的，比如`ViewComponent`和`ViewWithFragmentComponent`，则还是可以使用作用域注解`@ViewScoped`的，但是这没有什么意义，因为`ViewComonent`的范围是包含了`Fragment`的。


##### @Provide和@Binds

`@Provide`前面有说过了，是在Module中用来修饰方法的，被它修饰的方法代表着提供依赖的方法，当需要该类型的依赖对象时，就会调用对应返回值的方法去注入依赖。

在Module中，类名和方法名都是没有意义的，可以随便起名(当然为了可读性还是不要随便起名)，至于提供什么依赖完全看函数的返回值类型。若是返回值类型是一个接口呢？。

举个例子，比如有个接口`Human`，两个子类`Man和Woman`：

```kotlin
interface Human {
    fun sex(): String
}

class Man @Inject constructor() : Human {
    override fun sex(): String {
        return "男"
    }
}

class Woman @Inject constructor() : Human {
    override fun sex(): String {
        return "女"
    }
}
```
若是想要在Activity中注入该怎么处理呢，简单，构造方法已经加入注解了，然后直接注入即可：

```kotlin
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @Inject lateinit var man: Man

    @Inject lateinit var woman: Woman

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        println("Man:${man.sex()}, Woman: ${woman.sex()}")
    }
}
```
那我要是想要在Activity中注入Human而不是具体的子类型，该怎么办呢？首先我们知道，Hilt注入的时候是根据类型来查找依赖关系的。顺序是先从当前组件上的Module上查找返回值类型为这个类型的方法，找不到后再去看这个类型的类上的构造方法上是否有`@Inject`注解，有的话就直接生成一个对象注入了。

而若是注入类型为Human的，因为Human是个接口，是没有构造方法的，因此也是没法去@Inejct的。因此，若是想注入一个接口类型，必须要为它提供一个module。


```kotlin
@Module
@InstallIn(ActivityComponent::class)
object HumanModule {

    @Provides
    fun provideMan():Human {
        return Man()
    }
}
```

给`ActivityComponent`上安装这个Module后，就可以在`Activity`中使用`Human`注入了。另外这里注意一点，*Module一般是用来提供不可以直接注入的对象*，也就是三方库系统类那样的无法在构造方法添加`@Inject`的类，对于我们自己的类，如上面的`Man`对象，则不要在`provideMan`方法中直接去`new`一个对象，而是应该使用注入的方式，如下：

```kotlin
@Module
@InstallIn(ActivityComponent::class)
object HumanModule {
    
    @Provides
    fun provideMan(man:Man):Human {
        // 方法参数中的参数，会被Hilt直接注入
        // 所以若是提供依赖的方法含有参数的话，参数必须是能够被注入的，否则会报错
        return man
    }
}


@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @Inject lateinit var man: Human

    @Inject lateinit var woman: Human

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        println("Man:${man.sex()}, Woman: ${woman.sex()}")
    }
}
```

这样，在Activity中虽然可以注入Human了，但是注入的两个对象man和woman实际类型都是`Man`。若是想要它们不一样该怎么处理呢？


```kotlin
@Module
@InstallIn(ActivityComponent::class)
object HumanModule {

    @Provides
    fun provideMan(man:Man):Human {
        return man
    }

    @Provides
    fun provideWoman(woman: Woman):Human {
        return woman
    }
}
```
如上面的这个代码，直接再加一个方法，提供Woman对象，这样可以吗？当然是不行的，Hilt是根据返回值类型来选择使用哪个方法去生成依赖对象的。这两个方法的返回值都是Human，会导致注入的时候不知道该用哪个，因此这样写在编译的时候就会直接报错了。

##### Qualifier

`@Qualifier`就是用来解决上述问题的，当moudle中的两个或多个方法返回的类型是同样的时候，就代表着有了依赖冲突，肯定是编译不过的。因此就需要解决冲突，而解决冲突的方式就是给它们添加限定符，这样就可以将它们区分开了。
注意注入的时候也要加上限定符：


```kotlin
// 定义两个注解，这两个注解用@Qualifier注解，代表着两种限定符
@Qualifier
annotation class ManType

@Qualifier
annotation class WomanType

// 给module中重复的类型添加限定符
@Module
@InstallIn(ActivityComponent::class)
object HumanModule {
    @ManType
    @Provides
    fun provideMan(man:Man):Human {
        return man
    }

    @WomanType
    @Provides
    fun provideWoman(woman: Woman):Human {
        return woman
    }    
}

// 使用的时候也要加上限定符
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @ManType
    @Inject
    lateinit var man: Human

    @WomanType
    @Inject
    lateinit var woman: Human

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        ...
    }
}
```
可以看到上例中，有两个方法返回的都是Human，但是通过`ManType`和`WomanType`注解进行了区分，在Activity中注入的时候也是要进行区分的，否则仍然会导致编译失败。若是在注入的时候不想使用`Qualifier`，那么可以在Module中再增加一个方法，不加以任何修饰，这样就可以使用默认的了。


```kotlin
@Module
@InstallIn(ActivityComponent::class)
object HumanModule {
    @ManType
    @Provides
    fun provideMan(man: Man): Human {
        return man
    }

    @WomanType
    @Provides
    fun provideWoman(woman: Woman): Human {
        return woman
    }

    @Provides
    fun provideDefault(man: Man): Human {
        return man
    }
}

// 在Activity中的这三种注入，分别对应上面module中的方法
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @ManType
    @Inject
    lateinit var man: Human // Man类型，provideMan方法提供

    @WomanType
    @Inject
    lateinit var woman: Human // Woman类型，provideWoman方法提供

    @Inject
    lateinit var default: Human // Man类型，provideDefault方法提供

    ...
}
```
上述就是`Qualifier`方法的使用情景，从开始到现在我们都是在module中使用`@Provides`去提供依赖，实际上还可以通过`@Binds`去提供依赖，这里改一下module：

```kotlin
@Module
@InstallIn(ActivityComponent::class)
abstract class HumanModule {
    @ManType
    @Binds
    abstract fun provideMan(man: Man): Human

    @WomanType
    @Binds
    abstract fun provideWoman(woman: Woman): Human

    @Binds
    abstract fun provideDefault(man: Man): Human
}
```
可以看到和使用`Provides`的区别就是：module必须是一个`抽象类`，`@Provides`换成了`@Binds`，提供依赖的方法必须是一个`抽象方法`，这个抽象方法`只能有一个参数`，`必须有返回值`。这里注意的是提供依赖的方法是个抽象方法，返回值类型是提供的依赖类型，而参数就是实际返回的依赖对象。因此，`@Binds`仅适用于返回父类型的情况，所以抽象方法的返回值类型必须是参数的父类型。

相同类型的话仍然是通过`Qualifier`去进行区分的，所以`@Provides`方式的`module`是可以完全取代`@Binds`方式的。

这里举例是用接口举例的，实际上对于不是接口的也是可以的，甚至是同一个对象也是没问题的。因为Hilt会将限定符和返回值作为一组判定，只要不发生重复即可，所以返回值是接口还是父类都无关紧要的，如下这样也是可以的：

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetModule {
    
    @MyRelease
    @Provides
    fun provideRelease():Retrofit {
        return Retrofit.Builder()
            .baseUrl("http://www.xxx.com/")
            .build()
    }
    
    @MyTest
    @Provides
    fun provideTest() :Retrofit {
        return Retrofit.Builder()
            .baseUrl("http://test.com/")
            .build()
    }
}

@Qualifier
annotation class MyTest
@Qualifier
annotation class MyRelease
```



#### 其他


其他默认提供的依赖，常用的一个`Application`，两种`Activity`，两种`Context`：

```kotlin
    // Application，实际类型是我们自定义的App
    @Inject
    lateinit var mApp:Application
    
    // 在同一个Activity种，这种两注解拿到的都是同一个对象
    @Inject
    lateinit var activity:Activity
    @Inject
    lateinit var fragmentActivity: FragmentActivity
    
    // 这是Application对应的Context，使用限定符@ApplicationContext区分
    @ApplicationContext
    @Inject
    lateinit var mAppContext: Context
    
    // 这是Activity对应的Context，使用限定符@ActivityContext区分
    @ActivityContext
    @Inject
    lateinit var mContext: Context
```

可以看到，Hilt的入口点和组件息息相关。而除了这些入口点外，还能自定义入口点，但是意义不大，因为Hilt定义的入口点基本已经覆盖了Android中比较重要的东西了。所以自定义入口点意义不大。





## 附页

#### 为什么Hilt可以用原生的方式去创建ViewModel

Hilt对于`ViewModel`的创建方式和原生的创建方式是一致的，唯一的差别就是Hilt中在`ViewModel`加入了`@HiltViewModel`和`@Inject`两个注解。

原生有以下两种方式创建：

```kotlin
// 方式一，使用activity-ktx提供的委托机制（还有fragment-ktx）
private val viewModel by viewModels<MyViewModel>()
    
// 方式二，使用最基本的获取方式
viewModel = ViewModelProvider(this)[MyViewModel::class.java]
```

其实这两种方式实际都是一样的原理，都是通过`getDefaultViewModelProviderFactory()`方法去创建一个`ViewModelProvider.Factory`，然后由这个`Factory`去创建`ViewModel`。

所以，若是想要像正常那样创建`ViewModel`，则必须要重写`getDefaultViewModelProviderFactory`方法。实际上，编译时Hilt会根据注解去对于使用`@AndroidEnterPointer`注解的入口点类生成一个父类，然后通过字节码插桩方式去将该类的父类改为Hilt生成的类。这里这个类就是`Hilt_MainActivity`。

```java
public abstract class Hilt_MainActivity extends AppCompatActivity implements GeneratedComponentManagerHolder {
  ...
  @Override
  public ViewModelProvider.Factory getDefaultViewModelProviderFactory() {
    return DefaultViewModelFactories.getActivityFactory(this, super.getDefaultViewModelProviderFactory());
  }
}
```

而在`Hilt_MainActivity`中也能看到，它确实重写了`getDefaultViewModelProviderFactory`。

注意第二个参数是`super.getDefaultViewModelProviderFactory`，这是原本的Factory。沿着`getActivityFactory`继续追踪下去，最终会走到`HiltViewModelFactory`中去，这个类也是Factory的实现类。

```java
public final class HiltViewModelFactory implements ViewModelProvider.Factory {
  ...
  @NonNull
  @Override
  public <T extends ViewModel> T create(@NonNull Class<T> modelClass) {
    if (hiltViewModelKeys.contains(modelClass.getName())) {
      return hiltViewModelFactory.create(modelClass);
    } else {
      return delegateFactory.create(modelClass);
    }
  }
}
```

只看我们关注的部分，也就是Factory接口的实现方法`create`。从中也可以看出，当`hiltViewModelKeys`中包含当前要创建的`ViewModel`的类名的时候，使用`hiltViewModelFactory`去创建，否则使用`delegateFactory`去创建。

其中`delegateFactory`就是前面说的那个`super.getDefaultViewModelProviderFactory`，也就是原本的Factory。当`ViewModel`加了`@HiltViewModel`注解后，Hilt就会为它生成一个名字叫做`原类名_HiltModules`的类，并且有个静态的`provide`方法，该方法返回`ViewModel`的完整类名：

```java
public final class MyViewModel_HiltModules {
    ...
    @Provides
    @IntoSet
    @HiltViewModelMap.KeySet
    public static String provide() {
      return "com.example.myapplication.MyViewModel";
    }
  }
}
```

而前面`HiltViewModelFactory`中的`hiltViewModelKeys`就是调用每个`xxx_HiltModules#provide`方法形成的Set集合。所以到这里就很清晰了：

-   若是`ViewModel`使用了`@HiltViewModel`注解，就会使用`hiltViewModelFactory`去创建实例。

-   若是没有使用，则使用`delegateFactory`(也就是默认的Factory)去创建实例。
<br/>


**所以，`ViewModel`上是否使用`@HiltViewModel`都是能正常运行的。但是：**

-   <不使用注解> 默认的Factory只能创建**空参构造方法**的`ViewModel`。

-   <使用注解>   Hilt的Factory可以创建**带参数构造方法**的`ViewModel`，当然参数必须也是可以进行注入的。


