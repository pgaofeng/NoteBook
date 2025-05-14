---
title: 在Compose中使用Navigation
date: 2024-01-02 16:11:03
categories: Third Libraries
tags: 
  - Jetpack
banner_img: img/cover/cover-navigation.webp
---



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

### navigation

在`NavHost`中，我们还可以使用`navigation`将一组`composable`整合起来，这样做可以方便我们进行模块划分。

```kotlin
NavHost(...) {
        // 单独的界面
        composable(route = Graph.HOME) {
            ...
        }
        composable(route = Graph.ME) {
            ...
        }

        //组合起来的界面
        navigation(
            route = "Main",
            // 内部的起始界面
            startDestination = "pageA"
        ) {
            composable(route = "pageA") {
                ...
            }
            composable(route = "pageB") {
                ...
            }
        }
}
```

如上代码，在`NavHost`除了普通的`composable`界面外，还使用`navigation`将一组界面包含在了一块，即嵌套界面。注意我们可以从外层的界面跳转到嵌套内部的界面，但是不能从内部的界面跳到外部的界面。

```kotlin
// 跳转到内部的界面，此时是pageA界面
navController.navigate("Main")
```

这种模式适合对某个特定功能封装的情况，即某个功能模块的界面都封装在一块。

### composable

在`NavHost`定义界面时，使用`composable`方法定义一个界面，使用`dialog`方法定义一个对话框界面，实际上我们甚至可以在`composable`中不去定义对应的界面，而是直接跳转到其他的`Activity`，当然我们一般不这样用。

```kotlin
public fun NavGraphBuilder.composable(
    route: String,
    arguments: List<NamedNavArgument> = emptyList(),
    deepLinks: List<NavDeepLink> = emptyList(),
    enterTransition:.. = null,
    exitTransition:.. = null,
    popEnterTransition:.. = enterTransition,
    popExitTransition:.. = exitTransition,
    sizeTransform:.. = null,
    content: @Composable AnimatedContentScope.(NavBackStackEntry) -> Unit
) {
}
```

稍微简化下可以看到它的定义中，有我们前面了解的那四个动画以及一个`sizeTransfrom`，前面在`NavHost`中定义的动画属于全局动画，也就是它所有的界面都会应用这四个动画，但如果想要与众不同的话，则需要在`composable`中设置单属于自己这个界面的动画。

### arguments

除了这五个参数外，我们需要关注的就是`route`，这是当前界面的路由地址，通过该`route`就可以跳转到这个界面。然后另一个参数就是`arguments`，正常我们跳转界面都会携带参数，在`Activity`中我们使用`Intent`传递参数，在这里肯定不能直接使用`Intent`了，而是使用`route`+`arguments`来传递参数。

```kotlin
NavHost(...) {
    // 定义一个界面，界面路由为Graph.ME常量字符串
	composable(
        route = "${Graph.ME}/{uid}/{uname}?sex={sex1}&age={age}",
        arguments = listOf(
            // uid的参数描述，注意名字和占位符保持一致
            navArgument("uid") {
                type = NavType.IntType
            },
            // 注意名字是占位符内的sex1，而不是前面的sex，当然如果保持一致也是可以的
            navArgument("sex1") {
                type = NavType.StringType
                nullable = true
                defaultValue = "未知"
            }
        )
	) { entry->
       // 获取到传递的参数
       Log.d(TAG, entry.arguments?.getInt("uid"))
       Log.d(TAG, entry.arguments?.getString("uname"))
       // 注意！！查询的key不是sex，而是占位符sex1
       Log.d(TAG, entry.arguments?.getString("sex1"))
       //
       MyScreen(）
    }
}
                
// 其他地方跳转到该界面
navController.navigate("${Graph.ME}/100/张三?sex=男&age=20")
```

可以看到在传递参数时，参数列表是已经定义在`composable`中的，主要集中在`route`中，表现形式类似于`URL`。其中可以将参数跟在主`route`后面，使用`/`的形式，然后参数使用占位符`{}`描述，如上面例子中的`uid`和`uname`。还有一种形式的参数是通过`?`后面进行拼接的参数，如`sex1`和`age`。

定义完占位符后，需要在`arguments`数组中描述占位符的类型，可以通过`navArgument`方法快速定义。然后描述类型使用`type`表示类型，`nullable`表示参数是否可空，`defaultValue`表示默认值。

需要注意一点的是：对于路径占位符（即跟随在`/`后的占位符），不论是否可空，在跳转时都是不可省略的，因此不需要声明默认值`defaultValue`。

```kotlin
// 例如有一个graph为pageA/name，并且在描述中将name设置为可空的
// 1.跳转必须带该参数
navController.navigate("pageA/张三")
// 2.参数即使为空也要添加
val nm = null
navController.navigate("pageA/$nm")
```

而对于 查询占位符（`?`后的占位符），如果将其设置为了可空的，则需要设置默认值，并且在跳转时参数可以省略不写。

```kotlin
// 例如有一个graph为pageB?name=${name}，并且在描述中设置为可空的
// 1.正常跳转
navController.navigate("pageB?name=张三")
// 2.参数可以为空，查询到的也是null
val nm = null
navController.navigate("pageB?name=$nm")
// 3.直接忽略不写，查询到的是默认值
navController.navigate("pageB")
```

***当参数名和占位符不一致时，查询需要查占位符***，例如`route=pageC?name={other}`，此时查询时需要以`other`为`key`来获取参数值。

另外注意的就是占位符描述可以不加，即我在`route`中有定义占位符，但是我在`arguments`中不去声明这个占位符的类型等信息也是可以的。

### deepLinks

`deepLinks`定义的是`url`类型的匹配符，即从网页端直接跳转到当前界面来。用法和原来的`Activity`一样，只是原来是从外部跳转到对应的`Activity`，而现在只有一个`Activity`了，就会跳到当前的`Activity`后，再由`Navigation`拦截并跳转到对应的界面而已。

```kotlin
composable(
   ...
   deepLinks = listOf(
        navDeepLink {
            uriPattern = "test://mypage/{name}?age={age}"
        }
   )
) {
}
```

其中参数的传递仍然是以占位符的形式进行传递的，接下来就是在`AndroidManifest`中添加对应的`filter`。

```xml
<activity
    android:exported="true"
    ...
    <intent-filter>
        <action android:name="android.intent.action.VIEW"/>
        <category android:name="android.intent.category.BROWSABLE"/>
        <data android:scheme="test" android:host="mypage" />
</intent-filter>
```

然后就可以响应外部的界面了，我们可以在其他`html`界面中嵌入`<a href="test://mypage/wang?age=20">点击跳转</a>`超链接，当点击超链接的时候就可以跳转到我们对应的界面了。或者测试用`adb`命令也是一样的：

```bash
adb shell am start -a android.intent.action.VIEW -d "test://mypage/wang?age=20" com.example.myapplication/.MainActivity
```

到这里`NavHost`相关的基本上都已经了解了，接下来我们继续看`navController`。

## NavController

`NavController`是用来控制跳转的，在创建`NavHost`的时候第一个参数就是它，后续需要把它传递到每个界面中，然后在对应的界面中通过它来跳转。同样的，我们也可以通过它来获取到`Context`以及对应的`Activity`。

```kotlin
// 直接跳转
navController.navigate(Graph.ME)
// 返回
navController.navigateUp()
```

最简单的用法就是上面这种方法，注意在`Navigation`中也是存在任务栈的，和`Activity`的任务栈一样，当通过`navigate()`方法跳转时，会把跳转的界面入栈，此时栈内就有两个界面，一个是原来的界面，栈顶是新跳转的界面。如果要返回，可以通过`navigateUp()`方法出栈，或者直接按手机上的返回按钮，也是一样的逻辑。

也就是说，使用了`Navigation`后，每个`composable`界面和原来的`Activity`对应，界面的出栈入栈对应`Activity`的出栈入栈。而同样的，在每个`composable`获取的`ViewModel`也是一样会跟随界面的销毁而销毁。在`composable`界面中，通过方法`viewModel()`获取`ViewModel`实例。

```kotlin
@Composable
fun PageA(navController: NavController) {
    val viewmodel:PageViewModel = viewModel()
    Button(onClick = {
        // 点击按钮跳转到详情界面
        navController.navigate(Graph.DETAIL)
    }) {
        Text(text = viewModel.buttonString)
    }
}

@Composable
fun PageDetail(navController: NavController) {
    val viewmodel:DetailViewModel = viewModel()
    Button(onClick = {
        // 点击按钮返回到上一级页面
        navController.navigateUp()
    }) {
        Text(text = "详情界面")
    }
}
```

如上述实例的两个界面，每个界面都有他们自己对应的`ViewModel`，当从`PageA`跳转到`PageDetail`的时候，`PageA`实际上还是在任务栈中没有销毁的，因此`PageViewModel`并不会销毁。而从`PageDetail`返回到`PageA`的时候，由于`PageDetail`界面被销毁了，因此它对应的`DetailViewModel`也会被销毁掉，和`Activity`的表现是一致的。

另外，我们可以使用`popBackStack()`来弹出多个界面。

```kotlin
// 弹出当前界面
navController.popBackStack()
// 弹出多个界面，直到目标界面
navController.popBackStack(Graph.ME, true)
```

对于带参数的`popBackStack`，第一个参数是目标界面，第二参数是否包含自己。例如当前的任务栈有由以下几个界面组成`A->B->C->D`，如果我们在`D`界面通过`popBackStack(B, true)`，则会将`DCB`全部弹出，此时回到`A`界面，如果第二参数设置为`false`，表明不包含`B`，则只会弹出`DC`，此时回到`B`界面。

这是返回的操作退出任务栈，如果我们想在跳转的时候清除任务栈，例如登录成功后跳转到首页，此时就需要在跳转时就将登录界面弹出。

```kotlin
// 跳转到首页
navController.navigate(Graph.HOME) {
    // 跳转前弹出界面到LOGIN界面
    popUpTo(Graph.LOGIN) { 
    	// 是否包含LOGIN界面
        inclusive = true
    }
}
```

由于我们可以轻易弹出界面，所以我们也可以来实现`Activity`的四种启动模式了。对于标准启动模式，我们什么都不需要做，默认就是标准启动模式。

对于`singleTop`模式，也是默认支持的，只需要我们在跳转时设置为`singleTop`即可。

```kotlin
navController.navigate(Graph.HOME) {
    launchSingleTop = true
}
```

对于`singleTask`模式，我们需要手动弹出其他界面。

```kotlin
navController.navigate(Graph.ME) {
    // 弹出Graph.ME上面的所有界面
    popUpTo(Graph.ME) { inclusive = false }
    // 设置为此次singleTop模式
    launchSingleTop = true
}
```

但是对于`singleInstance`模式，似乎就无法完成了。

## 总结

至此，基本上已经了解了`Navigation`的使用方式了。实际上，在`Compose`中，`Navigation`是非常非常适合用来做路由的一个库，通过它我们可以以原来的`Activity`开发思想来进行设计，降低我们的学习曲线。关于`Navigation`的功能，总结下就是跳转返回、参数传递、任务栈管理。













