---
title: Flutter界面跳转-Navigator
date: 2024-06-16 21:47:02
categories: Flutter
tags:
 - Flutter
banner_img: img/cover/cover-flutter-navigator.webp
---

`Flutter`中通过`Navigator`实现的页面跳转和控制，实现像安卓中的`Activity`跳转一样的功能。对于学习`Flutter`而言，必须要先掌握这些跳转的基础知识，而后才能继续往后学习。

### 路由

和大多数导航路由工具一样，`Navigator`也是使用的栈的数据结构来管理路由表的。在安卓中，每个界面被称为一个`Activity`，而在`Flutter`中每个界面就是一个路由`PageRoute`，对路由的管理即是对界面的管理。

`Navigator`将路由分为匿名路由和实名路由，匿名路由就是一个单独的`Route`，路由内部通过`builder`去构建界面的`widget`树，想要跳转到哪个界面，只需要将`Route`添加到路由栈中即可。

实名路由则是给每个`Route`起一个独一无二的名字，然后通过路由表将名字和路由进行映射，后续跳转时只需要传入路由名字，`Navigator`会自动从路由表中找到对应的路由进行入栈操作。

#### 匿名路由跳转

路由跳转即是路由的入栈和出栈，对应的方法也是我们非常熟悉的`push`和`pop`。

```dart
static Future<T?> push<T extends Object?>(BuildContext context, Route<T> route) {
    return Navigator.of(context).push(route);
  }
```

使用方式非常简单，直接通过`Navigator.push`调用即可，第二个参数即是界面路由`Route`，注意这里的`Route`是一个抽象类，实际中可以传入各种路由，如`PageRoute`、`DialogRoute`、`PopRoute`等等，根据实际进行选择。

```dart
class Page1 extends StatelessWidget {
  const Page1({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        color: Colors.blue,
        child: Center(child: Text("Page1")),
      ),
    );
  }
}
```

如上我们有一个`Page1`的界面，如果我们想要从其他界面界面跳转，只需要将`Page1`包裹成`PageRoute`，然后通过`Navigator.push`跳转即可。

```dart
child: TextButton(
  onPressed: () => Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => const Page1()
    ),
  ),
  child: Text("首页"),
)
```

例如上面这个例子，在首页中有一个按钮，当按下按钮时就会通过`push`跳转到`Page1`界面。这里用的`PageRoute`是`MaterialPageRoute`，也可以换成`iOS`风格的`CupertinoPageRoute`它们的区别就是跳转动效不同。

```dart
MaterialPageRoute({
    // 构建widget树
    required this.builder,
    // 路由设置，可以设置名称和参数
    super.settings,
})
```

在`settings`中，可以设置路由的名字和参数，作为匿名路由，我们不需要设置名字，但是可能需要设置参数，用于界面间的数据交互。

```dart
class RouteSettings {
  const RouteSettings({this.name, this.arguments});
  final String? name;
  final Object? arguments;
}
```

参数`arguments`是一个`Object`类型的数据，数据在子界面中通过`ModalRoute`获取。

```dart
class Page1 extends StatelessWidget {
  const Page1({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        color: Colors.blue,
        child: Center(child: Text(
           // ModalRoute.of获取实例，从而通过settings拿到参数
           ModalRoute.of(context)!.settings.arguments.toString()
        )),
      ),
    );
  }
}
```

以上是匿名路由的跳转方式，总结下来就是构建一个`MaterialPageRoute`，然后通过`Mavigator.push`进行跳转，参数传递则是放在了`PageRoute`的`settings`参数中。而返回也是非常简单，正常返回可以直接按返回键或者通过手势返回，也可以通过`pop`方法进行返回。

```dart
TextButton(
  onPressed: () => Navigator.pop(context),
  child: Text("返回"),
),
```

很简单，直接调用`pop`方法即可，如果想要给上一个界面传递参数的话，则通过`pop`的第二个参数传递即可。

```dart
static void pop<T extends Object?>(BuildContext context, [T? result]) {
    Navigator.of(context).pop<T>(result);
}
```

例如我们点击按钮时，给上一个界面返回一个`hello`的字串：

```dart
// 子界面中点击按钮返回上一个界面
TextButton(
  onPressed: () => Navigator.pop(context, "hello"),
  child: Text("返回"),
),

// 上一个界面通过await获取返回值
TextButton(
  onPressed: () async {
    // 在跳转出等待返回值
    final params = await Navigator.push(...);
    print("params=$params");
  },
  child: Text("首页"),
),
```

以上就是匿名路由的跳转和返回的方法，以及跳转参数传递和返回参数回传的方式。实际上还有几个跳转方式也是比较常用的，例如`pushAndRemoveUntil`方法。

```dart
static Future<T?> pushAndRemoveUntil<T extends Object?>(
    BuildContext context,
    Route<T> newRoute,
    RoutePredicate predicate,
)
```

它相对于普通的跳转，多了一个`predicate`参数。该跳转方式是跳到新的路由中，然后清除路由栈中已存在的路由，直到`predicate`返回`true`为止。

```dart
Navigator.pushAndRemoveUntil(
   context,
   MaterialPageRoute(
     builder: (_) => const Page3(),
   ),
   (route) => route.settings.name == 'home',
)
```

如上例，就是当跳转到`Page3`界面时，移除栈内已有的名称为`home`的路由之上的所有路由，不包括`home`，当然，对于这种判定名称来决定是否移除的场景，可以直接使用`ModalRoute.withName`来构建`predicate`。

同理，对于界面返回时也是有一个相同类型的方法的，`popUntil`也是比普通的`pop`多一个参数，用来判断需要移除多少个界面。

```dart
static void popUntil(BuildContext context, RoutePredicate predicate) {
    Navigator.of(context).popUntil(predicate);
}
```

当需要返回时，可以通过该方法进行返回，它会一直将栈顶界面移除，直到`predicate`返回`true`。

#### 实名路由跳转

以上看的都是匿名路由的跳转方式，实际上匿名路由的使用场景是非常少的，大部分都会采用实名路由来实现路由管理。实名路由是给每个路由设置一个名字，并且将其存放在路由表中进行管理，后续跳转时直接传入路由名称，而不需要传入路由实体即可。

```dart
MaterialApp(
  theme: ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
  ),
  initialRoute: '/',
  routes: {
    "/": (context) => const HomePage(),
    "page1": (_) => const Page1(),
    "page2": (_) => const Page2(),
    "page3": (_) => const Page3()
  },
);
```

路由表的设置是在应用的最顶层的`MaterialApp`中设置的，主要设置两个参数，一个是`initialRoute`表示初始路由，一个是`routes`的集合存放的是各种路由。在路由的`map`集合中，路由名称是可以随便定义的，类型是字符串类型，注意，**通常情况下，将`/`定义为首页**，如果路由表中存在`/`路由的话，初始化路由`initialRoute`可以省略不写。

路由跳转使用的是`pushNamed`：

```dart
static Future<T?> pushNamed<T extends Object?>(
    BuildContext context,
    String routeName, {
    Object? arguments,
})
```

和`push`相比， 参数从`route`变成了`routeName`，也就是说不需要我们手动去创建`Route`了，因而也无法设置`settings`来传递参数了，所以这个方法额外提供了一个参数`arguments`用来传递参数。

在下一个界面中获取传递的参数方式还是一样的`ModalRoute.of(context)!.settings.arguments`。

和匿名路由相对应的，还有一个`pushNamedAndRemoveUntil`，也是跳转一个新的路由界面时，移除已存在的路由，直到`predicate`返回`true`。

```dart
static Future<T?> pushNamedAndRemoveUntil<T extends Object?>(
    BuildContext context,
    String newRouteName,
    RoutePredicate predicate, {
    Object? arguments,
}) 
```

界面返回的方法是共用的，`pop`和`popUntil`两种返回，但是多了一个`popAndPushNamed`，该方法是移除当前界面时，加入一个新的界面，类似于替换。

```dart
static Future<T?> popAndPushNamed<T extends Object?, TO extends Object?>(
    BuildContext context,
    String routeName, {
    // pop的老路由的返回值
    TO? result,
    // 新路由的参数
    Object? arguments,
})
```

### 总结

默认的路由导航`Navigator`比较简单，主要的就是路由的跳转和返回，以及跳转时的参数携带。这里又分为了实名路由和匿名路由，匿名路由直接通过`Navigator`进行跳转即可，直接传入对应的路由即可，但是这种方式对路由的管理比较混乱，因此实际中用的也比较少。

实名路由是通过路由表进行管理的，路由表定义在`MaterialApp`中，以`Map`的数据结构进行管理，`key`是路由名称，对应的是字符串类型，`value`是一个函数类型，用于构建界面的`Widget`树。跳转是通过名称进行跳转，而不用传入实际的路由，项目中基本都使用实名路由的方式进行管理。









