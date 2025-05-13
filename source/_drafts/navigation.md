---
title: 在Compose中使用Navigation
date: 2024-01-02 16:11:03
categories: Third Libraries
tags: 
  - Jetpack
banner_img: img/cover/cover-navigation.webp
---

# Navigation

`Navigation`是`Jetpack`组件中的一个成员，主要作用是用于页面间的导航跳转。在很早之前谷歌就在推单`Activity`多`Fragment`架构，而`Navigation`就是用于管理`Fragment`的跳转的，当时是使用`xml`来声明导航图进行导航的，再加上没有必要对项目进行太大的改造，就一直没有去学习其使用的方式。而随着`Coompose`的逐渐完善，谷歌也对`Navigation`进行了适应性开发，使其也能支持`Compose`中的页面跳转，因此`Navigation`就成了必须要学习的了。



## 引入Navigation

引入`Navigation`比较简单，直接添加依赖就行，注意要添加对应的`Compose`版本。截止到最新，已经是2.9.0版本了，使用该版本对`CompileVersion`和`APG`版本都有要求，引入时可以直接进行同步编译，然后根据错误提示升级对应的其他插件的版本。

```kotlin
dependencies {
    ...
    val nav_version = "2.9.0"
    implementation("androidx.navigation:navigation-compose:$nav_version")
}
```



## 简单使用

使用起来和其他导航组件是一样的，都是先定义导航图，然后根据`key`去进行跳转。这里导航图是通过`NavHost`进行创建的，跳转是通过`NavController`去实现的。因此，我们需要在可组合函数的最顶层中定义出这两个成员，然后将`NavController`传递给每一个界面，这些界面就通过它来进行跳转。

首先要定义不同的导航路径，该路径就是每个页面的路径，就类似于`Key`的作用，用来标识每个界面。可以使用一个具体的类名来标识，也可以使用一个字符串来标识。一般我们使用字符串进行标识，因为使用类的话，需要为每个界面单独创建一个类，太过于浪费资源了。

```kotlin
object Graph {
    const val HOME = "home"
    const val ME = "me"
    const val DETAIL = "detail"
}
```

导航图通过`NavHost`创建，即将对应的路径与页面进行关联。

```kotlin
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            // 创建的navController用于控制页面跳转，需要将其传递给每个页面
            val navController = rememberNavController()
            // 创建导航图，表明开始路径
            NavHost(navController, startDestination = Graph.HOME) {
                // 每个路径对应的页面
                composable(route = Graph.HOME) {
                    HomeScreen(navController)
                }
                // 每个路径对应的页面
                composable(route = Graph.ME) {
                    MeScreen(navController)
                }
                // 每个路径对应的页面
                composable(route = Graph.DETAIL) {
                    DetailScreen(navController)
                }
            }
        }
    }
}
```

以上就是定义导航图的方式，用起来还是比较简单的，后续只需要关注这几个界面即可，并且由于`startDestination`是`Home`，因此当我们启动这个`MainActivity`时，显示的界面就是`HomeScreen`界面。如果我们要跳转，可以通过`navigation`方法进行跳转，如下：

```kotlin
@Composable
fun HomeScreen(navController: NavController) {
    Text(
        text = "首页",
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
            .clickable(true) {
                // 点击时跳转到ME界面
                navController.navigate(Graph.ME)
            },
        color = Color.Blue,
        fontSize = 20.sp,
    )
}
```

跳转通过`navController.navigate`跳到指定的界面，然后通过`navController.navigateUp`返回。当然，按下返回键实际上也相当于执行了`navigateUp`，会进行返回。

到这里，我们其实已经掌握了最简单的使用方式了，即定义导航图，然后进行跳转和返回。但实际中我们肯定不会这么简单的，因为会涉及到参数的传递、`ViewModel`的使用、界面跳转的动销等等，接下来我们继续看下详细的功能。

## NavHost

`NavHost`是用来创建导航图的，它本质上是个接口类，当然我们并不需要关注它的类型，我们直接使用对应的方法即可。在`NavHost.kt`中，提供了一个方法来创建导航图，与接口类的名称是一样的，方法名也是`NavHost`。我们需要关注的是它的方法参数。

- `navController` 导航控制器，与当前`NavHost`关联的控制器，当前`host`中定义的界面就是通过该控制器进行跳转返回等操作。
- `startDestination`起始的导航页，注意这里类型在不同的函数重载中可以为`String`也可以为`KClass`类型，具体要根据自己的定义导航的方式。
- `modifier`页面参数修改器，该修改器影响的是路由的整个界面。
- `contentAlignment` 注释说是`AnimatedContent`的对其方式，但是`AnimatedContent`自己已经有这个参数了，它为啥还要用你提供的呢？
- `route`暂未发现有什么用，网上说是用于多个`NavHost`之间跳转，实测不行。
- `enterTransition`进入界面的切换动画、`exitTransition`原界面的消失动画、`popEnterTransition`返回时进入界面的动画、`popExitTransition`返回时原界面的消失动画。如果不指定的话，`popEnter`和`enter`的动画是一致的，`popExit`和`exit`的动画是一致的。举个例子：A界面跳转到B界面，此时A界面执行`exit`动画，B界面执行`enter`动画；然后从B界面返回到A界面时，B界面执行`popExit`动画，A界面执行`popEnter`动画。
- `sizeTransform`动画过程中的控制
- `builder`创建对应的界面

以上就是创建`NavHost`的参数，我们重点关注的就是起始页以及四个动效，从而控制我们页面的跳转动画。在最后一个参数`builder`中，我们需要创建对应的界面，通常我们使用`composable`方法来声明一个普通界面，通过`dialog`声明一个对话框界面。











