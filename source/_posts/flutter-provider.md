---
title: Flutter状态管理框架Provider
date: 2024-10-5 15:01:28
categories: Flutter
tags:
 - Flutter
banner_img: img/cover/cover-flutter-provider.webp
---

`Flutter`中最值得关注的也就是状态管理了，其根本目的在于状态提升，达到的效果是方便管理状态以及子组件中共享状态。

## Provider

前面[Flutter状态管理](https://pgaofeng.github.io/2024/09/10/flutter-state/)我们也有探索过直接将状态提升到最顶层，但是会引起状态多层传递，散落到各个组件中，并且状态变化时会导致整个界面全部刷新，为了解决这个问题，我们可以使用`InheritedWidget`保存状态，在使用的地方通过`ListenableBuilder`+`ChangeNotifier`实现局部刷新。当然，使用起来可能会稍微复杂一些，于是我们将其封装成了一个`MyProvider`以供简化使用。

现在有这么一个三方库，它就是利用这一套逻辑进行封装，方便我们管理状态的，就是`Provider`。

### 引入

地址：[https://pub.dev/packages/provider](https://pub.dev/packages/provider)

直接在`pubspec.yaml`中引入最新版本的即可：

```yaml
dependencies:
  provider: ^6.1.5+1
```

### 提供状态

提供状态，实际上也就是保存状态，以方便子组件获取状态。`Provider`提供多种方式提供状态，同时它本身也会对状态进行管理，在合适的时候创建和销毁，以及状态变化时将状态分发给使用的子组件。

#### Provider

最简单也是最基础的提供一个状态值，通过`Provider`构造函数进行声明。

```dart
Provider({
    Key? key,
    // 构建新的值
    required Create<T> create,
    // 组件被移除时调用
    Dispose<T>? dispose,
    // 是否懒加载，默认懒加载
    bool? lazy,
    // 构建子组件的代码块，主要是提供了context
    TransitionBuilder? builder,
    // 子组件，当设置了builder后，界面默认不会使用child，需要在构建时加入
    Widget? child,
})

// 对外提供的值是一个已有的值
Provider.value({
    Key? key,
    // 已有的值
    required T value,
    // 当值变化时是否需要通知子组件更新
    UpdateShouldNotify<T>? updateShouldNotify,
    TransitionBuilder? builder,
    Widget? child,
})
```

状态创建的代码块是必选的，其他参数都是可选的，使用起来也是非常简单，直接将其放置在顶层作为父组件即可，子组件中就能查到对应的数据。一共两个方法可供选择使用，直接调用`Provider`需要在`create`中创建一个新的值，如果这个值已经存在，只是想要将其暴露出去的话，使用`Provider.value`方式。

```dart
// 父组件
class HomeWidget extends StatelessWidget {
  const HomeWidget({super.key});

  @override
  Widget build(BuildContext context) {
    // 使用Provider提供了一个颜色，红色
    return Provider<Color>(
      create: (_) => Colors.red,
      child: ChildWidget(),
    );
  }
}

// 子组件
class ChildWidget extends StatelessWidget {
  const ChildWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 100,
      height: 100,
      // 子组件中可以直接获取到对应的值
      color: context.watch<Color>(),
      child: TextButton(
        onPressed: () {},
        child: Center(child: Text('Button')),
      ),
    );
  }
}
```

上面的代码主要逻辑就是通过`Provider`提供了一个颜色值，然后在它子组件中能够获取到对应的值并进行使用，其实我们没必要将它们单独拆分成两个组件，合在一起也是一样的效果：

```dart
class HomeWidget extends StatelessWidget {
  const HomeWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Provider<Color>(
      create: (_) {
        return Colors.red;
      },
      // 直接将子组件合并在一块
      child: Container(
        width: 100,
        height: 100,
        // 获取父组件Provider提供的颜色 ERROR
        color: context.watch<Color>(),
        child: TextButton(
          onPressed: () {},
          child: Center(child: Text('Button')),
        ),
      ),
    );
  }
}
```

注意以上逻辑，当父组件和子组件合并在一块时，运行会直接报错，而报错原因就在于我们获取状态所用的`context`，它并不是子组件`Container`的`context`，因此无法找到对应的状态而报错。所以我们需要拿到子组件的`context`，我们可以在子组件外再包一层`Builder`或者直接使用参数`builder`：

```dart
class HomeWidget extends StatelessWidget {
  const HomeWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Provider<Color>(
      create: (_) => Colors.red,
      // 通过builder构建子组件，能够提供context
      builder: (context, child) => Container(
        width: 100,
        height: 100,
        color: context.watch<Color>(),
        child: TextButton(
          onPressed: () {},
          child: Center(child: Text('Button')),
        ),
      ),
      // 或者使用Builder再包一层
     // child: Builder(builder: (context) => Container(
     //   width: 100,
     //   height: 100,
     //   color: context.watch<Color>(),
     //  child: TextButton(
     //     onPressed: () {},
     //     child: Center(child: Text('Button')),
     //   )
     // ),
    );
  }
}
```

这种提供一个单值的方式作用不大，既然是提供状态，我们的目的肯定是一个能够变化的状态值，这种提供单值的情况下无法变化状态。或许我可以传一个`ChangeNotifier`呢？传`ChangeNotifier`当然是可以的，但是我们一般也不会这样用，我们会直接使用`ChangeNotifierProvider`。

#### ChangeNotifierProvider

`ChangeNotifierProvider`的参数列表和`Provider`是一致的，只是它限定了传递的参数类型必须是`ChangeNotifier`的子类。

```dart
ChangeNotifierProvider({
    Key? key,
    required Create<T> create,
    bool? lazy,
    TransitionBuilder? builder,
    Widget? child,
})
    
ChangeNotifierProvider.value({
    Key? key,
    required T value,
    TransitionBuilder? builder,
    Widget? child,
})
```

注意`ChangeNotifierProvider`也是提供了两个构造方法，和`Provider`基本上时一致的，如果对外暴露的是一个新创建的`ChangeNotifier`，则使用默认构造函数声明；如果这个`ChangeNotifier`已经存在了，我们只是想要将其暴露给外面，则使用`value`的构造函数。

#### ListenableProvider

`ListenableProvider`和`ChangeNotifierProvider`是一样的，参数列表是一模一样的，唯一的区别就是`ListenableProvider`限定的类型是`Listenable`，比`ChangeNotifier`更灵活一些。

```dart
ListenableProvider({
    Key? key,
    required Create<T> create,
    Dispose<T>? dispose, // 多了一个dispose参数
    bool? lazy,
    TransitionBuilder? builder,
    Widget? child,
})
    
ListenableProvider.value({
    Key? key,
    required T value,
    // 数据变化时是否通知依赖的子组件更新
    UpdateShouldNotify<T>? updateShouldNotify,
    TransitionBuilder? builder,
    Widget? child,
}) 
```

`ChangeNotifierProvider`提供的是一个`ChangeNotifier`类型的数据，并且当该组件被移除时，会自动调用`ChangeNotifier#dispose`来情况监听者，它是继承自`ListenableProvider`的。`ListenableProvider`限定的数据类型是`Listenable`类型的，并且不会自动移除监听者，需要手动传入`dispose`参数来自己管理。

#### ValueListenableProvider

```dart
ValueListenableProvider.value({
    Key? key,
    required ValueListenable<T> value,
    UpdateShouldNotify<T>? updateShouldNotify,
    Widget? child,
})
```

对外暴露一个`ValueListenable`类型的数据，注意这里只有一个`.value`的命名构造方法，也就是只能通过它来暴露一个数据，而不能直接创建一个数据。

#### FutureProvider

```dart
FutureProvider({
    Key? key,
    // 创建一个Future
    required Create<Future<T>?> create,
    // 初始值
    required T initialData,
    // 错误异常
    ErrorBuilder<T>? catchError,
    UpdateShouldNotify<T>? updateShouldNotify,
    bool? lazy,
    TransitionBuilder? builder,
    Widget? child,
})
    
FutureProvider.value({
    Key? key,
    required Future<T>? value,
    required T initialData,
    ErrorBuilder<T>? catchError,
    UpdateShouldNotify<T>? updateShouldNotify,
    TransitionBuilder? builder,
    Widget? child,
})
```

`FutureProvider`的作用是提供一个创建可能比较耗时的对象，它先提供一个初始值供子组件使用，当执行完耗时操作后再返回出新的对象来更新子组件。

```dart
// 提供一个颜色
FutureProvider<Color>(
  create: (_) async {
     // 获取这个颜色比较耗时，需要3秒
     await Future.delayed(Duration(seconds: 3));
     return Colors.blue;
   },
   // 提供一个默认的初始值红色
   initialData: Colors.red,
   child: Builder(
     builder: (context) {
       // 获取到颜色
       final color = context.watch<Color>();
       return Container(
         width: 100,
         height: 100,
         // 使用颜色
         color: color,
         child: TextButton(
           onPressed: () {},
           child: Center(child: Text('Button')),
         ),
       );
     },
   ),
);
```

以上的效果就是界面显示一个红色的方块，然后过了三秒后变成蓝色。

#### StreamProvider

```dart
StreamProvider({
    Key? key,
    // 提供一个Stream
    required Create<Stream<T>?> create,
    // 提供的初始值
    required T initialData,
    ErrorBuilder<T>? catchError,
    UpdateShouldNotify<T>? updateShouldNotify,
    bool? lazy,
    TransitionBuilder? builder,
    Widget? child,
})
    
StreamProvider.value({
    Key? key,
    required Stream<T>? value,
    required T initialData,
    ErrorBuilder<T>? catchError,
    UpdateShouldNotify<T>? updateShouldNotify,
    bool? lazy,
    TransitionBuilder? builder,
    Widget? child,
})
```

`StreamProvider`和`FutureProvider`基本上是一样的，构造方法的参数列表基本上也是一样的，只不过一个是提供的`Future`类型的数据，一个是提供`Stream`类型数据。

#### ProxyProvider

`ProxyProvider`的作用是根据外部其他状态来提供新状态，前面我们提到的各种`Provider`都是直接创建一个新的对象或者对外暴露已有的对象，不涉及其他`Provider`。而`ProxyProvider`却是根据别的`Provider`提供的对象来提供新的对象。

```dart
ProxyProvider0({
    Key? key,
    // 创建一个初始值
    Create<R>? create,
    // 当状态变化时调用
    required R Function(BuildContext context, R? value) update,
    UpdateShouldNotify<R>? updateShouldNotify,
    Dispose<R>? dispose,
    bool? lazy,
    TransitionBuilder? builder,
    Widget? child,
  })
```

`ProxyProvider0`接受一个参数，该参数就是它提供的类型，其中参数`create`会创建一个初始值，随后会调用`update`来进行更新，后续依赖的对象发生变化时，都会调用`update`来返回一个新的值。

```dart
ProxyProvider0<String>(
  update: (BuildContext context, String? value) {
     return '蓝色';
   },
   child: Builder(
     builder: (context) {  
       // 子组件可以获取到依赖的值
       final text = context.watch<String>();
       return Container(
         width: 100,
         height: 100,
         child: TextButton(
            onPressed: () {},
            child: Center(child: Text(text)),
         ),
       );
     },
  ),
);
```

对于`ProxyProvider0`而言，它实际上是不需要依赖于别的`Provider`的，本身就能直接提供一个对象，类似于`Provider`。当然，如果想要依赖的话，也是可以的。

```dart
// 定义了一个ChangeNotifier，并添加了一个Color属性
class CircleController with ChangeNotifier {
  Color _color = Colors.red;

  get color => _color;
  set color(value) {
    _color = value;
    notifyListeners();
  }
}

// 使用ChangeNotifierProvider将这个参数提供出去
ChangeNotifierProvider<CircleController>(
  create: (_) => CircleController(),
  // 子组件是一个ProxyProvider0，提供的参数是String类型
  child: ProxyProvider0<String>(
      // 这个参数preview是前一次的数据，对于第一次调用update时，
      // 如果有create，则是create返回的初始值，否则为null，
      update: (BuildContext context, String? preview) {
      final controller = context.watch<CircleController>();
      if (controller.color == Colors.red) {
        return '红色';
      } else {
        return '蓝色';
      }
    },
    // 子组件      
    child:Container() ...
  ),
);
```

也就是我们在`update`的时候去依赖了其他`Provider`提供的对象，然后根据这个对象将其进行转换，然后返回新的数据。为了渐变，他们还提供了已经帮我们依赖好的方法，就是`ProxyProvider`：

```dart
ProxyProvider({
    Key? key,
    Create<R>? create,
    // T是依赖的类型，R是返回的类型
    required ProxyProviderBuilder<T, R> update,
    UpdateShouldNotify<R>? updateShouldNotify,
    Dispose<R>? dispose,
    bool? lazy,
    TransitionBuilder? builder,
    Widget? child,
})
    
// 它的update类型如下
typedef ProxyProviderBuilder<T, R> = R Function(
  BuildContext context,
  T value,// 依赖的对象
  R? previous,// 上一次的值
);
```

也就是说，如果我们需要根据一个依赖的对象来返回另一个对象，则可以使用`ProxyProvider`，此时在`update`中就能直接通过`value`参数访问依赖的对象了，而不需要手动去`context.watch`了。

如果依赖两个或对象多个对象，则使用相应后缀的方法即可：

```dart
// 不依赖对象，想要依赖的话自己在update中通过context建立依赖
ProxyProvider0<R>
// 依赖一个对象，在update中通过value访问
ProxyProvider<T, R>
// 依赖两个对象，在update中通过value和value1访问
ProxyProvider2<T, T2, R>
ProxyProvider3<T, T2, T3, R>
ProxyProvider4<T, T2, T3, T4, R>
ProxyProvider5<T, T2, T3, T4, T5, R>
ProxyProvider6<T, T2, T3, T4, T5, T6, R>
```

简单来说，`ProxyProvider`更类似于一个`map`转换函数，根据依赖的对象来转换成新的数据，并将其提供出去。

#### ListenableProxyProvider

```dart
ListenableProxyProvider0({
  Key? key,
  Create<R>? create,
  // update参数必选，preview是前一次调用时的数据
  required R Function(BuildContext, R? previous) update,
  Dispose<R>? dispose,
  UpdateShouldNotify<R>? updateShouldNotify,
  bool? lazy,
  TransitionBuilder? builder,
  Widget? child,
})
```

普通的`ListenableProvider`直接创建或者暴露一个`Listenable`，不涉及其他外部参数。而`ListenableProxyProvider`虽然也是提供一个`Listenable`类型的数据，但是它在创建`Listenable`时需要依赖外部其他的对象或者说其他`Provider`提供的数据。其实就和`ProxyProvider`是一样的，也根据依赖的对象的个数创建了一系列的类：

```dart
// 默认不依赖对象，如果想依赖，则可以在update中自己通过context去依赖
ListenableProxyProvider0<R extends Listenable?>
// 依赖一个对象，在update中通过value访问
ListenableProxyProvider<T, R extends Listenable?>
// 依赖两个对象，在update中通过value和value1访问
ListenableProxyProvider2<T, T2, R extends Listenable?>
ListenableProxyProvider3<T, T2, T3, R extends Listenable?>
ListenableProxyProvider4<T, T2, T3, T4, R extends Listenable?>
ListenableProxyProvider5<T, T2, T3, T4, T5, R extends Listenable?>
ListenableProxyProvider6<T, T2, T3, T4, T5, T6, R extends Listenable?>
```

#### ChangeNotifierProxyProvider

大体上都是同一样的逻辑，限定了提供对象类型为`ChangeNotifier`，但是创建`ChangeNotifier`时又需要依赖于外部其他对象，因此使用带`proxy`的方法来创建。

```dart
ChangeNotifierProxyProvider0({
    Key? key,
    // create也是必选的
    required Create<R> create,
    // update也是必选的
    required R Function(BuildContext, R? value) update,
    bool? lazy,
    TransitionBuilder? builder,
    Widget? child,
})
```

它和前面的几个`Proxy`类型区别就是，它的`create`也是必选的用于创建初始值，后续当依赖的对象发生变化时会触发`update`，而我们在`update`中也不要直接创建一个新的`ChangeNotifier`，而是应该通过`getter/setter`方法来对其进行更新，然后再返回。

```dart
// 不依赖于其他对象，如果要依赖可以在update中手动处理
ChangeNotifierProxyProvider0<R extends ChangeNotifier?>
// 依赖一个对象，在update中通过value访问
ChangeNotifierProxyProvider<T, R extends ChangeNotifier?>
// 依赖两个对象，在update中通过value和value1访问
ChangeNotifierProxyProvider2<T, T2, R extends ChangeNotifier?>
ChangeNotifierProxyProvider3<T, T2, T3, R extends ChangeNotifier?>
ChangeNotifierProxyProvider4<T, T2, T3, T4, R extends ChangeNotifier?>
ChangeNotifierProxyProvider5<T, T2, T3, T4, T5, R extends ChangeNotifier?>
ChangeNotifierProxyProvider6<T, T2, T3, T4, T5, T6, R extends ChangeNotifier?>
```

####  MultiProvider

正常一个`Provider`只能提供一个值，如果想要提供多个值的话，可以使用`MultiProvider`，它能够组合多个`Provider`：

```dart
MultiProvider({
    Key? key,
    // Provider集合
    required List<SingleChildWidget> providers,
    // 子组件
    Widget? child,
    // 构建子组件
    TransitionBuilder? builder,
})
```

当使用`MultiProvider`时，会忽略它合并的多个`Provider`的子组件，而是使用它自己的子组件。

```dart
MultiProvider(
  providers: [
    Provider(create: (_) => CircleController()),
    ChangeNotifierProvider(create: (_)=>MyChangeNotifier()),
  ],    
  // 子组件
  child: 
)
```

子组件中，可以访问`providers`中提供的所有的数据。

### 使用状态

#### context#watch

```
T watch<T>() {
  return Provider.of<T>(this);
}
```

使用`Context`的拓展方法`watch`获取到依赖的数据，并且会建立一个依赖关系，当`watch`的数据发生变化时，会主动进行刷新。该方法只能在`StatelessWidget#build`或者`State#build`中调用。使用方式如下：

```dart
// 创建一个对象，持有颜色状态
class CircleController with ChangeNotifier {
  Color _color = Colors.red;

  get color => _color;
  set color(value) {
    _color = value;
    notifyListeners();
  }
}

ChangeNotifierProvider<CircleController>(
  create: (_) => CircleController(),
  child: Builder(
    builder: (context) {
      // 获取到依赖的对象
      final controller = context.watch<CircleController>();
      return Container(
        width: 100,
        height: 100,
        // 使用颜色
        color: controller.color,
        child: TextButton(
          onPressed: () {
            //点击按钮时修改颜色
            controller.color = Colors.blue;
          },
          child: Center(child: Text('Button')),
        ),
      );
    },
  ),
)
```

如上示例，在子组件中通过`watch`获取到`CircleController`时，会自动建立依赖关系。当点击按钮时修改了`CircleController`的颜色属性，`Provider`就会自动通知到我们触发重建，从而响应变化。

#### context#read

```dart
T read<T>() {
  return Provider.of<T>(this, listen: false);
}
```

`read`也是获取依赖的数据的，它和`watch`的区别就是本身不会建立依赖关系，也就是获取到状态后，即使状态发生了变化，也不会触发自身的重建，从而无法响应状态的变化。例如前面的例子中，将`watch`直接改为`read`，再点击按钮时发现是没有任何变化的。

#### context#select

```dart
R select<T, R>(R Function(T value) selector) {
    ...
}
```

当使用`watch`获取状态时，例如获取一个`ChangeNotifier`，此时该组件会与`ChangeNotifier`建立关系，当它内部的任意一个属性变化时（同时触发了`notifyListeners`），都会导致该组件重建。而使用`select`则可以有选择性的与某几个属性建立依赖关系。

```dart
ChangeNotifierProvider<CircleController>(
  create: (_) => CircleController(),
  child: Builder(
    builder: (context) {
      // 获取到依赖的对象的具体字段
      final color = context.select<CircleController,Color>((value)=>value.color);
      return Container(
        width: 100,
        height: 100,
        // 使用颜色
        color: color,
        child: TextButton(
          onPressed: () {
            //点击按钮时修改颜色会触发重建
            context.read<CircleController>().color = Colors.blue;
            // 如果修改别的属性就不会触发重建
            // context.read<CircleController>().size += 40;
          },
          child: Center(child: Text('Button')),
        ),
      );
    },
  ),
)
```

#### Provider#of

```dart
static T of<T>(BuildContext context, {bool listen = true}) {...}
```

实际上，前面的`watch`和`read`都是对`Provider#of`方法的包装而已，他们的区别就是`listen`的取值。当取值为`true`时，表示获取状态时并且建立关联，此时也就相当于`watch`，当状态发生变化时会通知依赖方进行重建。取值为`false`时表明不会建立关联。

前面这几个方法都是通过`context`获取的，这就很容易造成`context`滥用的情况，从而导致无法完成局部刷新。也就是说，在通过`watch`、`select`、`Proivider.of(context, listen:true)`获取依赖值并建立关联时，是与`context`所属的组件建立的关联，当触发刷新时会导致`context`所在的组件被`rebuild`。

```dart
class CircleController with ChangeNotifier {
  Color _color = Colors.red;

  get color => _color;
  set color(value) {
    _color = value;
    notifyListeners();
  }
}
```

例如有一个`ChangeNotifierProvider`提供了上面这个`CircleController`，然后对应的子组件如下：

```dart
class MyWidget extends StatelessWidget {
  const MyWidget({super.key});

  @override
  Widget build(BuildContext context) {
    // 获取到CircleController并建立依赖关系
    final controller = context.watch<CircleController>();

    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          color: Colors.green,
          child: Text('One'),
        ),
        Container(
          width: 80,
          height: 80,
          color: controller.color,
          child: TextButton(
            onPressed: (){
              // 点击按钮时修改颜色
              controller.color = Colors.yellow;
            },
            child: Text('Two')
          ),
        ),
        Container(
          width: 80,
          height: 80,
          color: Colors.blue,
          child: Text('Three'),
        ),
      ],
    );
  }
}

```

上述子组件中，包含了一个`Column`，然后里面放了三个`Container`，其中第二个`Container`使用了`controller`中的颜色，并且在点击时修改了颜色。

注意，调用`watch`的`context`是`MyWidget`的`context`，但是实际用到的却只有它内部的一个`Container`，但是当颜色发生变化时，刷新是刷的`MyWidget`，也就是说会重新调用`MyWidget#build`来构建。这显然与我们的预期不符了，我们应该只想要`Container`进行重建，其他组件包括`Container`内部的`TextButton`都不发生重建。

当然了我们可以使用`Builder`来获取对应的`Context`:

```dart
// 将第二个Container用Builder包一下来获取context
Builder(builder: (context) {
  // 此时的Context是Builder的
  final controller = context.watch<CircleController>();
  return Container(
    width: 80,
    height: 80,
    color: controller.color,
    child: TextButton(
      onPressed: (){
        // 点击按钮时修改颜色
        controller.color = Colors.yellow;
      },
      child: Text('Two')
    ),
  );
}),
```

通过这种方式，可以将刷新范围限定在`Builder`中，也就是当点击按钮修改了颜色之后，并不会导致整个`MyWidget`的重建，而只会重建这个`Builder`。当然，这基本上已经能满足我们的需求了，实现了局部的刷新，但我们要求的可能还要更高一些，我们想只有`Container`重建，它内部的`child`不需要重建，通过这种方式就很难完成了。

#### Consumer

```dart
Consumer({
    Key? key,
    required this.builder,
    // 不可变部分可以放在child避免重建
    Widget? child,
})
```

前面几种获取状态的方法都是通过`context`获取的，也就是说需要我们手动去`watch`，很容易导致`context`的滥用而导致刷新范围不可控。使用`Consumer`就可以非常容易的控制范围，例如前面的那个`Container`刷新问题，就可以使用`Consumer`进行优化：

```dart
Consumer<CircleController>(
  // 可以直接拿到依赖的controller
  builder: (context, controller, child) {
    return Container(
       width: 80,
       height: 80,
       color: controller.color,
       child: TextButton(
         onPressed: (){
           controller.color = Colors.yellow;
         },
         child: Text('Two')
       ),
     );
  },
),
```

其实也就是避免了我们手写`watch`了，当然它还提供了一个`child`属性，我们可以将`Container`的`child`放在外面声明，然后直接应用就行了，这样刷新时就只会刷新`Container`，而不会刷新按钮了。

```dart
Consumer<CircleController>(
  builder: (context, controller, child) {
    return Container(
      width: 80,
      height: 80,
      color: controller.color,
      // 不变部分直接引用就行
      child: child,
    );
  },
  // 不变部分声明在这里
  child: TextButton(
    onPressed: () {
      // 只是read，不建立依赖关系，所以使用哪个context没啥太大的影响
      context.read<CircleController>().color = Colors.yellow;
    },
    child: Text('Two'),
  ),
),
```

这是只依赖一个对象的`Consumer`，还可以选择`Consumer2`、`Consumer3`...

```dart
// 依赖一个对象，可以在builder中通过value访问
Consumer<T>
// 依赖两个对象，可以在builder中通过value和value2访问
Consumer2<A, B>
Consumer3<A, B, C>
Consumer4<A, B, C, D>
Consumer5<A, B, C, D, E>
Consumer6<A, B, C, D, E, F>
```

#### Selector

前面的`Consumer`其实对应的就是`watch`的封装，它观察的是整个控制`ChangeNotifier`，不论它内部的任何属性变化，只要调用了`notifyListeners`就会导致组件的重建。而可能有时候我们这个组件只使用了一个字段，只需要这个字段变化时重建就行，而不关注其他字段。

`Selector`其实做的就是这个工作，也就是对`select`的封装而已：

```dart
Selector({
    Key? key,
    // 构建组件树
    required ValueWidgetBuilder<S> builder,
    // 选择依赖哪些字段
    required S Function(BuildContext, A) selector,
    ShouldRebuild<S>? shouldRebuild,
    Widget? child,
})
```

同样的，还是对前面的那个`Container`进行修改：

```dart
Selector<CircleController, Color>(
  // 只关注颜色属性的变化
  selector: (context, controller) => controller.color,
  // 参数中直接拿到颜色，而不是controller
  builder: (context, color, child) {
    return Container(
      width: 80,
      height: 80,
      color: color,
      // 直接引用不变的部分
      child: child,
    );
  },
  // 不需要重建的部分声明在child中
  child: TextButton(
    onPressed: () {
      // 只是read，用哪个context无伤大雅
      context.read<CircleController>().color = Colors.yellow;
    },
    child: Text('Two'),
  ),
)
```

就和`Consumer`依赖多个对象一样，`Selector`也支持依赖多个对象，使用方式也是一样的：

```dart
// 不依赖对象，如果想要依赖，可以在selector中手动获取
Selector0<T>
// 依赖一个对象，在selector中通过value访问
Selector<A, S>
// 依赖两个对象，在selector中通过value和value1访问
Selector2<A, B, S>
Selector3<A, B, C, S>
Selector4<A, B, C, D, S>
Selector5<A, B, C, D, E, S>
Selector6<A, B, C, D, E, F, S>
```

### 总结

`Provider`作为状态管理，主要做的也就是提供状态和访问状态。提供状态用了多种`Provider`，实际中我们还是用的`ChangeNotifierProvider`比较多一些，当通过这些`Provider`提供状态后，子组件中就能够通过`context`获取到这些状态，实现对状态的使用和修改。

访问状态可以通过`context`获取，通常我们获取时会与状态建立关联，以便在状态发生变化时重建。而使用`context`获取容易造成滥用，所以通常会使用一些组件来获取状态，如`Consumer`和`Selector`。







