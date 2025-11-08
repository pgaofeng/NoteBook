---
title: GetX原理分析
date: 2024-12-20 19:37:03
categories: Flutter
tags:
 - Flutter
banner_img: img/cover/cover-flutter-getx-source.webp
---

`GetX`也是`Flutter`中非常火的一个项目，它不是一个单一功能的库，而是一个功能非常全面的脚手架，包括有依赖注入、状态管理、多语言、路由管理、网络请求等等，实际上对于规模较小的应用，基本上只使用这一个库就可以完成整个项目的开发了。当然也可以选择性的使用，例如我们可以只使用它的状态管理功能，其他功能使用别的方式实现也是可以的。

本文专注于`GetX`的依赖注入和状态管理，版本是`4.7.2`。

### 依赖注入

依赖注入是`GetX`非常重要的一个功能，它的很多其他功能其实都是以依赖注入为基础的，例如状态管理中，对于状态的提供就是通过依赖注入来创建了查询的。

使用中我们其实更倾向于用它作为依赖管理而不是依赖注入，即创建对象依旧由我们来控制，只是我们创建完之后交由`GetX`进行管理。

#### 注入

注入一个对象，我们最常用的注入方式就是直接通过`Get.put`添加一个已有的对象：

```dart
S put<S>(S dependency,// 注入的对象
     {String? tag, // tag
      bool permanent = false, // 是否永久存储
      InstanceBuilderCallback<S>? builder}) =>
  GetInstance().put<S>(dependency, tag: tag, permanent: permanent);
```

虽然该方法参数有四个，但是最后的一个参数`builder`并没有用到，这个`builder`是用来构建对象的函数，因为我们是直接注入已有对象的，因此不需要关注如何构建。

最后的关键实际上是直接调用了`GetInstance().put`完成的注入：

```dart
class GetInstance {
  // 实际上拿到的是单例对象
  factory GetInstance() => _getInstance ??= const GetInstance._();
  const GetInstance._();
  static GetInstance? _getInstance;
  // 存放注入对象的map集合  
  static final Map<String, _InstanceBuilderFactory> _singl = {};
  ...
}
```

简单看下，实际通过`GetInstance()`拿到的是全局单例对象，它内部有一个`map`集合，用于存储所有的对象，这就是依赖注入的基础，通过全局单例来实现全局都能进行注入和获取。

```dart
S put<S>(
    S dependency, {
    String? tag,
    bool permanent = false,
    @Deprecated("Do not use builder, it will be removed in the next update")
    InstanceBuilderCallback<S>? builder,
}) {
    // 具体逻辑是在`_insert`中
    _insert(
        isSingleton: true,
        name: tag,
        permanent: permanent,
        // 这里的builder直接返回实例本身
        builder: builder ?? (() => dependency));
    // 返回值是调用find来查询，而不是直接返回dependency对象
    return find<S>(tag: tag);
}
```

可以看到最终的逻辑是通过`_insert`完成的，实际上`GetX`的多种注入方式，如：`put`、`lazyPut`、`putAsync`、`create`最终都是通过`_insert`，将各种参数打包成一个`_InstanceBuilderFactory`，最终存储在集合中的。

```dart
void _insert<S>({
    bool? isSingleton,
    String? name,
    bool permanent = false,
    required InstanceBuilderCallback<S> builder,
    bool fenix = false,
  }) {
    // 根据类型获取key
    final key = _getKey(S, name);
    // 如果在集合中已经存在了
    if (_singl.containsKey(key)) {
      final dep = _singl[key];
      if (dep != null && dep.isDirty) {
        // 重新存储
        _singl[key] = _InstanceBuilderFactory<S>(
          isSingleton,
          builder,
          permanent,
          false,
          fenix,
          name,
          // 并将原来的factory记录在lateRemove中
          lateRemove: dep as _InstanceBuilderFactory<S>,
        );
      }
    } else {
      // 直接插入新的factory
      _singl[key] = _InstanceBuilderFactory<S>(
        isSingleton,
        builder,
        permanent,
        false,
        fenix,
        name,
      );
    }
}

// 如果设置了name（对应的是tag），则使用类型+tag，否则直接用类型作为key
String _getKey(Type type, String? name) {
   return name == null ? type.toString() : type.toString() + name;
}
```

这逻辑就很简单了，就是构建`key`（类型+`tag`），构建`value`（`_InstanceBuilderFactory`），然后将其存储在`map`集合中就完成了。其中`_InstanceBuilderFactory`如他的名字一样，实例构建工厂，当查询时，也会构建对应的`key`，然后查询到这个`factory`，由它来给出依赖的对象。

```dart
class _InstanceBuilderFactory<S> {
  // 是否是单例对象
  bool? isSingleton;
  // 保留构建工厂，即移除时只会移除依赖的对象，而不会移除构建对象的方法
  // 代表着如果我在A界面注入过ClassA，则其他任何界面都能再次获取到ClassA或者
  // 新的ClassA
  bool fenix;
  // 存储实例对象
  S? dependency;
  // 用于构建实例的builder
  InstanceBuilderCallback<S> builderFunc;
  // 是否永久存储实例
  bool permanent = false;
  // 是否已经初始化了
  bool isInit = false;
  // 重新put时，如果原来的factory被标记为dirty，则创建一个
  // 新的factory，老的就是这个
  _InstanceBuilderFactory<S>? lateRemove;
  // 标记为脏的
  bool isDirty = false;
  // tag
  String? tag;

  _InstanceBuilderFactory(
    this.isSingleton,
    this.builderFunc,
    this.permanent,
    this.isInit,
    this.fenix,
    this.tag, {
    this.lateRemove,
  });

  void _showInitLog() {
    if (tag == null) {
      Get.log('Instance "$S" has been created');
    } else {
      Get.log('Instance "$S" has been created with tag "$tag"');
    }
  }

  // 获取依赖实例
  S getDependency() {
    // 单例对象
    if (isSingleton!) {
      // 如果未初始化过，则通过builder构建
      if (dependency == null) {
        _showInitLog();
        dependency = builderFunc();
      }
      // 否则直接返回
      return dependency!;
    } else {
      // 非单例对象，通过builder构建对象
      return builderFunc();
    }
  }
}
```

`_InstanceBuilderFactory`中定义很多的参数，分别用于不同的场景。例如被标记为单例，则每次获取时实际上都是取的同一个对象，否则每次都是构建一个新的对象。

#### 获取

获取只有一个方法，`Get.find`。

```dart
S find<S>({String? tag}) => GetInstance().find<S>(tag: tag);
```

还是走的`GetInstance()`单例对象的`find`方法，这也与我们的预期相符，毕竟我们存储时就是将它存在`GetInstance()`中的一个`map`集合里。

```dart
// 是否已经注入过了
bool isRegistered<S>({String? tag}) => _singl.containsKey(_getKey(S, tag));

S find<S>({String? tag}) {
    // 构建key
    final key = _getKey(S, tag);
    // 如果已经注入过
    if (isRegistered<S>(tag: tag)) {
      // 取出factory
      final dep = _singl[key];
      // 初始化依赖
      final i = _initDependencies<S>(name: tag);
      // 直接通过getDependency获取实例
      return i ?? dep.getDependency() as S;
    } else {
      // 未注册过直接抛异常
      throw ...
    }
}
```

这里查询实际上也是直接构建`key`，然后从集合中取出对应的`factory`，从而获取到实例。注意这里在取出`factory`之后，还会调用一次`_initDependencies`，当它返回值为空时，才通过`fatory`来获取依赖对象。

```dart
S? _initDependencies<S>({String? name}) {
    // 构建key
    final key = _getKey(S, name);
    // 是否初始化过，默认是false
    final isInit = _singl[key]!.isInit;
    S? i;
    if (!isInit) {
      // 未初始化过的，如果是Controller，则初始化一次
      i = _startController<S>(tag: name);
      if (_singl[key]!.isSingleton!) {
        // 只有单例对象才有初始化
        _singl[key]!.isInit = true;
        if (Get.smartManagement != SmartManagement.onlyBuilder) {
          // 构建依赖关系
          RouterReportManager.reportDependencyLinkedToRoute(_getKey(S, name));
        }
      }
    }
    return i;
}
```

在初始化依赖中，会做两件事：一是对`controller`初始化，一是建立与路由的关联。

```dart
S _startController<S>({String? tag}) {
    final key = _getKey(S, tag);
    // 获取实例
    final i = _singl[key]!.getDependency() as S;
    // 一般我们用的GetController就是这个类型的子类
    if (i is GetLifeCycleBase) {
      // 调用它的onStart
      i.onStart();
      if (tag == null) {
        Get.log('Instance "$S" has been initialized');
      } else {
        Get.log('Instance "$S" with tag "$tag" has been initialized');
      }
      // 非单例对象会加入到当前路由的_routesByCreate集合中
      if (!_singl[key]!.isSingleton!) {
        RouterReportManager.appendRouteByCreate(i);
      }
    }
    return i;
}

static void appendRouteByCreate(GetLifeCycleBase i) {
    _routesByCreate[_current] ??= HashSet<Function>();
    // 将controller的onDelete加入到当前路由的集合中
    _routesByCreate[_current]!.add(i.onDelete);
}
```

这一步的初始化路由中，会先获取到依赖对象`Controller`，然后执行它的`onStart`方法，如果是非单例对象将其`onDelete`加入到当前路由的集合中，从而跟随路由的生命周期而执行。单例对象会在销毁时`onDelete`。

```dart
// 将依赖对象的key添加到当前路由的keys集合中，方便跟随路由生命周期变化
static void reportDependencyLinkedToRoute(String depedencyKey) {
    if (_current == null) return;
    if (_routesKey.containsKey(_current)) {
      _routesKey[_current!]!.add(depedencyKey);
    } else {
      _routesKey[_current] = <String>[depedencyKey];
    }
}
```

获取的整体逻辑也很简单，就是根据`key`获取到`factory`，然后开始构建对象。对于标记为单例的依赖，会在初始化时做一些操作。如果是`Controller`，则会调用它的`onStart`，并且将其`onDelete`加入到当前路由的`_routesByCreate`中。然后就是同时，也会将依赖对象的`key`加入到当前路由的`_routesKey`中。这也是依赖管理能够智能的处理依赖对象的生命周期的关键。**这也就是说，如果用到了`GetX`的依赖注入，就需要用它的路由管理，否则注入的对象一直在内存中无法释放。**

#### 生命周期

`GetX`的路由管理，实际上也就是在最顶层通过`GetMaterialApp`来替代`MaterialApp`，看起来是`GetX`实现的，但当我们点到内部逻辑的时候，就发现它其实就是对`MaterialApp`做了一层包装：

```dart
class GetMaterialApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) => GetBuilder<GetMaterialController>(
        ...
        builder: (_) => routerDelegate != null
            ? MaterialApp.router( // 实际上还是用了MaterialApp
                ...
            : MaterialApp( // 实际上还是用了MaterialApp
                ...
                navigatorObservers: (navigatorObservers == null
                    ? <NavigatorObserver>[
                        // 添加了一个GetObserver
                        GetObserver(routingCallback, Get.routing)
                      ]
                    : <NavigatorObserver>[
                        GetObserver(routingCallback, Get.routing)
                      ]
                  ..addAll(navigatorObservers!))
              ),
              ...
 }
```

可以看到，最终做路由的还是`MaterialApp`，只是`GetX`对他做了一些封装而已。而关于生命周期部分的，实际就在`GetObserver`中。

```dart
class GetObserver extends NavigatorObserver {
  ...
  @override
  void didPop(Route route, Route? previousRoute) {
    super.didPop(route, previousRoute);
    ...
    // 将当前route改为上一个界面
    if (previousRoute != null) {
      RouterReportManager.reportCurrentRoute(previousRoute);
    }
    ...
  }

  @override
  void didPush(Route route, Route? previousRoute) {
    super.didPush(route, previousRoute);
    // 将当前route改为新的界面
    RouterReportManager.reportCurrentRoute(route);
    ...
  }

  @override
  void didRemove(Route route, Route? previousRoute) {
    super.didRemove(route, previousRoute);
    ...
    // 界面被移除
    if (route is GetPageRoute) {
      RouterReportManager.reportRouteWillDispose(route);
    }
  }

  @override
  void didReplace({Route? newRoute, Route? oldRoute}) {
    super.didReplace(newRoute: newRoute, oldRoute: oldRoute);
    ...
    // 设置当前路由为新路由
    if (newRoute != null) {
      RouterReportManager.reportCurrentRoute(newRoute);
    }
    // 老界面被移除
    if (oldRoute is GetPageRoute) {
      RouterReportManager.reportRouteWillDispose(oldRoute);
    }
    ...
  }
}
```

关键的就是这几个路由的回调方法，对应了路由的生命周期。主要就是在路由界面切换时，设置`RouterReportManager`中的`current`为新路由，当界面移除时，通过`reportRouteWillDispose`来通知做回收操作。那么回到`RouterReportManager`：

```dart
class RouterReportManager<T> {
  // 存储在当前路由中find的依赖对象的key
  static final Map<Route?, List<String>> _routesKey = {};
  // 存储在当前路由中find的Controller类型的依赖对象的onDelete方法
  static final Map<Route?, HashSet<Function>> _routesByCreate = {};
    
  // 设置当前路由，在界面发生变化时会调用  
  static void reportCurrentRoute(Route newRoute) {
    _current = newRoute;
  }
    
  static void reportRouteWillDispose(Route disposed) {
    // 将被移除路由中的key添加到集合中
    final keysToRemove = <String>[];
    _routesKey[disposed]?.forEach(keysToRemove.add);

    // 遍历路由中的controller的onDelete方法，并执行
    if (_routesByCreate.containsKey(disposed)) {
      for (final onClose in _routesByCreate[disposed]!) {
        onClose();
      }
      // 清空数据
      _routesByCreate[disposed]!.clear();
      _routesByCreate.remove(disposed);
    }
    // 将key对应的Factory标记为dirty
    for (final element in keysToRemove) {
      GetInstance().markAsDirty(key: element);
      // 这里应该移除的，但是并没有移除，而是注释掉了
      //_routesKey.remove(element);
    }
    keysToRemove.clear();
  }
}
```

它内部有三个静态变量，一个是`current`指向当前路由，一个是`_routesKey`内部存储的是每个路由中所使用的依赖对象的`key`（`find`）的时候加入的，一个是`_routesByCreate`存放的是每个路由中的所使用的`Controller`的`onDelete`方法。

当界面被移除时，就会通过`reportRouteWillDispose`方法来触发`onDelete`和移除依赖。**这里并没有直接移除，而只是将其标记为dirty**。

```dart
class GetInstance {
  void markAsDirty<S>({String? tag, String? key}) {
    final newKey = key ?? _getKey(S, tag);
    if (_singl.containsKey(newKey)) {
      final dep = _singl[newKey];
      // 只有未标记为permanent的才会标记为dirty
      if (dep != null && !dep.permanent) {
        dep.isDirty = true;
      }
    }
  }
}
```

真正移除的逻辑实际上是否发生在`PageRoute`的回调中：

```dart
class GetPageRoute<T> extends PageRoute<T>
    with GetPageRouteTransitionMixin<T>, PageRouteReportMixin {
    ...
}

mixin PageRouteReportMixin<T> on Route<T> {
  @override
  void install() {
    super.install();
    // 设置当前路由
    RouterReportManager.reportCurrentRoute(this);
  }

  @override
  void dispose() {
    super.dispose();
    // 路由dispose时的回调
    RouterReportManager.reportRouteDispose(this);
  }
}
```

在`GetPageRoute`中混入了一个`PageRouteReportMixin`类，然后在其对应的声明周期中做了一些处理，主要是在`dispose`的时候调用了`reportRouteDispose`。

```dart
class RouterReportManager<T> {
  // 这是在GetObserver中调用的，注意有个will
  static void reportRouteWillDispose(Route disposed) {
    ...
  }
  // 这是在GetPageRoute中调用的，真正dispose的时候 
  static void reportRouteDispose(Route disposed) {
    if (Get.smartManagement != SmartManagement.onlyBuilder) {
      _removeDependencyByRoute(disposed);
    }
  }
    
  static void _removeDependencyByRoute(Route routeName) {
    final keysToRemove = <String>[];
    // 将待移除的路由对应的key添加到集合中
    _routesKey[routeName]?.forEach(keysToRemove.add);

    // 调用非单例的controller的onDelete
    if (_routesByCreate.containsKey(routeName)) {
      for (final onClose in _routesByCreate[routeName]!) {
        onClose();
      }
      _routesByCreate[routeName]!.clear();
      _routesByCreate.remove(routeName);
    }
    // 遍历key
    for (final element in keysToRemove) {
      // 删除值
      final value = GetInstance().delete(key: element);
      if (value) {
        // 删除之后再从路由对应的集合中移除掉这个key
        _routesKey[routeName]?.remove(element);
      }
    }
    keysToRemove.clear();
  }
```

从这里也就可以看出，想要实现依赖的生命周期管理，即当路由移除时，同时销毁该路由上使用的依赖对象，是要依赖`GetX`的路由管理的，也就是需要有对应的`GetObserver`和`GetPageRoute`。

```dart
class GetInstance {

  bool delete<S>({String? tag, String? key, bool force = false}) {
    final newKey = key ?? _getKey(S, tag);
    // 获取到对应的factory
    final dep = _singl[newKey];

    final _InstanceBuilderFactory builder;
    // 其实在删除之前，已经被标记为dirty了
    if (dep.isDirty) {
      // 如果在标记为dirty之后，再去put的时候，就会
      // 新创建一个factory，然后它的lateRemove指向老的factory
      builder = dep.lateRemove ?? dep;
    } else {
      builder = dep;
    }
    // 标记为permanent，是不会被删除的，除非强制删除
    if (builder.permanent && !force) {
      return false;
    }
    // 获取依赖的实例
    final i = builder.dependency;
    // GetxServier也不会被删除
    if (i is GetxServiceMixin && !force) {
      return false;
    }
    // GetController的onDelete又被调用一次
    if (i is GetLifeCycleBase) {
      i.onDelete();
    }
    // 如果标记为finix，则清除依赖，恢复到初始状态，并不会直接移除掉
    if (builder.fenix) {
      builder.dependency = null;
      builder.isInit = false;
      return true;
    } else {
      // 在willDispose的时候被标记为dirty，随后又put了一次，就会出现这种情况
      if (dep.lateRemove != null) {
        dep.lateRemove = null;
        return false;
      } else {
        // 真正的移除
        _singl.remove(newKey);
        return true;
      }
    }
  }
}
```

前面说过，如果要使用依赖注入，就需要同时使用它的路由管理，这是为了能让他正常处理生命周期问题。当然了，如果确实是不想使用它的依赖管理，我们也可以自己定义一个`NavigatorObserver`，然后在这里面手动处理`RouterReportManager`。

总结下：`put`时构建`_InstanceBuilderFactory`，插入到`GetInstance()`中的`map`集合中。然后初次使用时，会将已使用的依赖的`key`加入到与当前路由相关的集合中，然后如果依赖是`Controller`也会调用它的`onStart`，然后当路由销毁时，会遍历`key`然后将其对应的`_InstanceBuilderFactory`从`GetInstance`中移除掉，并且会同步调用`Controller`的`onDelete`，从而实现了生命周期的管理。

### 状态管理

状态管理方面也是基本上利用的观察者模式，由顶层提供状态，子组件注册监听，当状态发生变换时刷新子组件以响应状态。当然，这里状态并不是由顶层提供的，而是直接利用了它的依赖注入功能，将持有状态的控制器注入到`GetInstance`中，这样子组件都能通过`GetInstance`获取了。并且，界面的控制器还能跟随界面进行变化，当界面销毁时同时会删除对应的控制器，非常方便。

状态管理有两种类型，一种是直接通过`GetController`，一种是通过`obs`拓展。

#### GetxController

提供状态的控制器可以使用`GetxController`，当然本质上使用任何对象都是可以的，使用`GetxController`是因为它本身有实现了`GetLifeCycleBase`，能够响应组件的生命周期变化，从而可以在合适的位置执行合适的操作。

```dart
class CircleController extends GetxController {
  Color _color = Colors.red;

  Color get color => _color;
  set color(Color value) {
    _color = value;
    // 通过update通知使用的子组件进行刷新
    update();
  }
}
```

其中`GetxController`的实现也是基于`Listenable`的，也是允许别的组件注册监听，当状态变化后，需要手动触发监听者的回调。

```dart
abstract class GetxController extends DisposableInterface
    with ListenableMixin, ListNotifierMixin {

  void update([List<Object>? ids, bool condition = true]) {
    if (!condition) {
      return;
    }
    // 如果未指定id，则全部刷新
    if (ids == null) {
      refresh();
    } else {
      // 否则只刷新对应的id
      for (final id in ids) {
        refreshGroup(id);
      }
    }
  }
}
```

我们通知对应的观察者时，应该直接调用`update`方法，而不是其他的`refresh`方法（虽然也是可以的）。从这个方法我们可以看出。`GetxController`将注册的监听分为了两类，一类是普通的监听者，一类是带`id`的监听者。

然后看下它的继承类以及混入类：

```dart
// 处理生命周期相关部分
abstract class DisposableInterface extends GetLifeCycle {
  @override
  @mustCallSuper
  void onInit() {
    super.onInit();
    Get.engine.addPostFrameCallback((_) => onReady());
  }
  @override
  void onReady() {
    super.onReady();
  }

  @override
  void onClose() {
    super.onClose();
  }
}
```

```dart
// 混入了Listenable，可以让我们addListener和removeListener
mixin ListenableMixin implements Listenable {}

// 在ListenableMixin的基础上做了别的操作
mixin ListNotifierMixin on ListenableMixin {
  
  // 存储普通的监听者
  List<GetStateUpdate?>? _updaters = <GetStateUpdate?>[];

  // 存储带id的监听者，key是id，value是一个集合，这个集合内部存的是监听者
  HashMap<Object?, List<GetStateUpdate>>? _updatersGroupIds =
      HashMap<Object?, List<GetStateUpdate>>();

  // 对外暴露的刷新方法
  @protected
  void refresh() {
    assert(_debugAssertNotDisposed());
    _notifyUpdate();
  }

  void _notifyUpdate() {
    // 遍历所有的普通监听者，然后进行调用，从而通知他们
    for (var element in _updaters!) {
      element!();
    }
  }

  // 通知指定id的监听者
  void _notifyIdUpdate(Object id) {
    // 从带id的监听者集合中获取所有的监听者，然后触发通知
    if (_updatersGroupIds!.containsKey(id)) {
      final listGroup = _updatersGroupIds![id]!;
      for (var item in listGroup) {
        item();
      }
    }
  }

  // 对外暴露的指定id的刷新方法
  @protected
  void refreshGroup(Object id) {
    assert(_debugAssertNotDisposed());
    _notifyIdUpdate(id);
  }

  

  @protected
  void notifyChildrens() {
    TaskManager.instance.notify(_updaters);
  }

  
  // 移除
  @override
  void removeListener(VoidCallback listener) {
    assert(_debugAssertNotDisposed());
    _updaters!.remove(listener);
  }

  // 移除
  void removeListenerId(Object id, VoidCallback listener) {
    assert(_debugAssertNotDisposed());
    if (_updatersGroupIds!.containsKey(id)) {
      _updatersGroupIds![id]!.remove(listener);
    }
    _updaters!.remove(listener);
  }

  // dispose
  @mustCallSuper
  void dispose() {
    assert(_debugAssertNotDisposed());
    _updaters = null;
    _updatersGroupIds = null;
  }

  // 添加
  @override
  Disposer addListener(GetStateUpdate listener) {
    assert(_debugAssertNotDisposed());
    _updaters!.add(listener);
    return () => _updaters!.remove(listener);
  }

  // 添加
  Disposer addListenerId(Object? key, GetStateUpdate listener) {
    _updatersGroupIds![key] ??= <GetStateUpdate>[];
    _updatersGroupIds![key]!.add(listener);
    return () => _updatersGroupIds![key]!.remove(listener);
  }

  // 
  void disposeId(Object id) {
    _updatersGroupIds!.remove(id);
  }
}
```

就是`GetxController`将注册的观察者分为了两类，一种是普通的观察者，一种是带id的观察者。这样，当状态发生变化时，可以直接通过`update()`通知到所有的普通观察者状态发生了变化，也可以通过`update([id1, id2])`通知指定`id`的通知者进行刷新。

这对于局部刷新还是比较实用的，例如在`controller`中有两个状态`A`和`B`，然后组件`WidgetA`使用状态`A`，组件`WidgetB`使用状态`B`，这样这两个组件在注册监听的时候，就可以指定不同的`id`进行注册，当状态`A`发生变化时，就可以只通知A对应的`id`的观察者。

状态提供上就直接继承自`GetxController`即可，使用上在组件中可以通过`GetBuilder`来注册监听：

```dart
// 通过泛型指定引用的controller，使用前必须要先put
GetBuilder<CircleController>(
  // 必填参数builder构建组件
  builder: (controller) => Container(
    // 使用控制器中的状态
    width: controller.size,
    height: controller.size,
    color: controller.color,
    child: Center(
      child: ElevatedButton(
        onPressed: ()  {},
        child: Text('Hello'),
      ),
    ),
  ),
);
```

使用上也比较简单，直接通过`GetBuilder`包裹住需要使用状态的组件即可，当状态发生变化时（触发了`update`方法），就会通知到这里来进行刷新。

```dart
const GetBuilder({
    Key? key,
    this.init,// 初始值，默认null
    this.global = true,
    required this.builder,
    this.autoRemove = true,// 自动移除依赖对象
    this.assignId = false,
    this.initState, // 生命周期回调
    this.filter,// 过滤器，用于过滤状态的
    this.tag,
    this.dispose, // 生命周期回调
    this.id,// 分组的id
    this.didChangeDependencies, // 生命周期回调
    this.didUpdateWidget, // 生命周期回调
})
```

构造方法参数较多，必选参数是`builder`，用于构建组件树的。此外，如果需要感应生命周期的变化，可以传入对应的生命周期的回调，另外`filter`也是比较重要的。一般情况下，我们会传入`builder`和`filter`两个参数。

```dart
class GetBuilder<T extends GetxController> extends StatefulWidget {
  ...
  @override
  GetBuilderState<T> createState() => GetBuilderState<T>();
}
```

基本上各个状态管理的库原理都是一样的，将依赖状态的组件通过`StatefulWidget`包裹，然后通过观察者模式观测状态的变化，当状态发生变化时，通过`setState`触发重建。

```dart
class GetBuilderState<T extends GetxController> extends State<GetBuilder<T>>
    with GetStateUpdaterMixin {

  @override
  void initState() {
    super.initState();
    // 参数回调
    widget.initState?.call(this);
    // 是否有put过这个控制器
    var isRegistered = GetInstance().isRegistered<T>(tag: widget.tag);
    // 是否是全局控制器，默认是true
    if (widget.global) {
      if (isRegistered) {
        // 是否初始化过对象，即put时的参数`_singleton`是否为false
        // 即这个对象是否是GetBuilder创建出来的
        if (GetInstance().isPrepared<T>(tag: widget.tag)) {
          _isCreator = true;
        } else {
          _isCreator = false;
        }
        // 查询控制器
        controller = GetInstance().find<T>(tag: widget.tag);
      } else {
        // 未put的话，使用init提供的依赖对象，然后注入到依赖注入中
        controller = widget.init;
        _isCreator = true;
        GetInstance().put<T>(controller!, tag: widget.tag);
      }
    } else {
      // 非全局对象直接使用参数init，并且不通过依赖注入进行管理
      controller = widget.init;
      _isCreator = true;
      controller?.onStart();
    }

    if (widget.filter != null) {
      // 通过filter，对controller进行计算，从而得出一个值
      // 当controller中的状态发生变化时，可以通过对比前后的filter是否
      // 一致来决定是否刷新，类似于Provider中的select
      _filter = widget.filter!(controller!);
    }
   // 注册监听
    _subscribeToController();
  }

  void _subscribeToController() {
    _remove?.call();
    _remove = (widget.id == null)
        // 无id，直接注册listener
        ? controller?.addListener(
            // 回调方法是`filterUpdate`或者`getUpdate`
            _filter != null ? _filterUpdate : getUpdate,
          )
        // 有id，注册带id的listener
        : controller?.addListenerId(
            widget.id,
            _filter != null ? _filterUpdate : getUpdate,
          );
  }

  void _filterUpdate() {
    // 根据新的controller计算filter值
    var newFilter = widget.filter!(controller!);
    // 只有不一致才会刷新
    if (newFilter != _filter) {
      _filter = newFilter;
      getUpdate();
    }
  }

  @override
  void dispose() {
    super.dispose();
    // 回调生命周期
    widget.dispose?.call(this);
    // 如果通过create创建的对象需要删除，put时singleton为false
    if (_isCreator! || widget.assignId) {
      if (widget.autoRemove && GetInstance().isRegistered<T>(tag: widget.tag)) {
        GetInstance().delete<T>(tag: widget.tag);
      }
    }
   // 移除监听
    _remove?.call();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // 回调生命周期
    widget.didChangeDependencies?.call(this);
  }

  @override
  void didUpdateWidget(GetBuilder oldWidget) {
    super.didUpdateWidget(oldWidget as GetBuilder<T>);
    // id不一致了则重新注册监听
    if (oldWidget.id != widget.id) {
      _subscribeToController();
    }
    // 回调生命周期
    widget.didUpdateWidget?.call(oldWidget, this);
  }

  @override
  Widget build(BuildContext context) {
    return widget.builder(controller!);
  }
}
```

在`GetBuilderState`中，主要做了生命周期的回调，以及在`initState`的时候向`Controller`中注册监听，并且在`dispose`的时候移除监听。然后就是依赖注入，它会在`initState`的时候主动帮我们查询到对应的依赖对象，并且在`dispose`的时候删除依赖对象（只有非单例对象才会删除，因为说明这个对象是在`GetBuilder`中`find`时新创建的，所以需要删除掉）。

当传入了`filter`后，刷新是通过`_filterUpdate`方法触发的，它会根据`filter`来计算`controller`，只有计算后的结果与之前不一致，说明`controller`中有我们关注的字段发生了变化，此时才会触发刷新。刷新方式是通过`getUpdate`进行刷新的，我们看下实现：

```dart
mixin GetStateUpdaterMixin<T extends StatefulWidget> on State<T> {
  void getUpdate() {
    if (mounted) setState(() {});
  }
}
```

原理还是非常简单，直接通过`setState`进行刷新。实际上在`GetxController`中，也可以通过指定`id`的注册监听器的方式实现局部刷新，这样在状态变化时就能只通知对应的id的观察者即可，这种性能比通过`filter`实现更高一些，因为它是从源头上控制的，而`filter`是在已经触发的回调中控制的。

#### obs、obx

对于需要更加精准的控制状态的场景下，使用`obs`拓展，将状态本身封装成一个可观察的数据类型。这样子组件就不需要直接对`GetxController`进行监听，而是可以更加精准的对状态本身进行监听。

```dart
class CircleController extends GetxController {
  final txt = 'Hello'.obs;
}

ElevatedButton(
   onPressed: () {
      controller.txt.value = 'newTxt';
   },
   child: Obx(() => Text(controller.txt.value)),
)
```

可以看到，使用方式上更加简便了。直接声明的对象通过`obs`拓展，使用的组件用`Obx`进行包裹即可，唯一的缺陷可能就是需要我们自己去`find`对应的控制器了（也可以使用`GetView`来帮我们获取）。

```dart
// 对任意类型进行拓展
extension RxT<T> on T {
  Rx<T> get obs => Rx<T>(this);
}
```

实际上，在前面还有很对`RxInt`和`RxBool`等拓展，是针对于基本属性的，使得我们可以不通过`.value`获取值，而是可以直接使用。这里我们看下对于通用的数据类型的拓展，实际就是将对象包装在了`Rx`中。

```dart
class Rx<T> extends _RxImpl<T> {
  Rx(T initial) : super(initial);

  @override
  dynamic toJson() {
    try {
      return (value as dynamic)?.toJson();
    } on Exception catch (_) {
      throw '$T has not method [toJson]';
    }
  }
}
```

这里没啥看的，就重写了`toJson`的方法，具体就不在细看了，总之就是在`_RxImpl`也是实现了一套基于观察者模式的代码，使得可以注册和移除监听。然后就是使用方面，直接通过`Obx`将用到状态的部分进行包裹即可。

```dart
class Obx extends ObxWidget {
  final WidgetCallback builder;
  const Obx(this.builder, {Key? key}) : super(key: key);
  @override
  Widget build() => builder();
}

// 可以看到，本质上还是一个StatefulWidget
abstract class ObxWidget extends StatefulWidget {
  const ObxWidget({Key? key}) : super(key: key);

  @override
  ObxState createState() => ObxState();

  @protected
  Widget build();
}

// 状态管理
class ObxState extends State<ObxWidget> {
  // 观察者
  final _observer = RxNotifier();
  late StreamSubscription subs;

  @override
  void initState() {
    super.initState();
    // 注册监听
    subs = _observer.listen(_updateTree, cancelOnError: false);
  }

  // 触发刷新，还是通过setState完成的
  void _updateTree(_) {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    subs.cancel();
    _observer.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      RxInterface.notifyChildren(_observer, widget.build);
}
```

`Obx`本质上就是一个有状态组件`StatefulWidget`，然后它在内部创建了一个观察者并设置了对应的回调方法，当触发回调时，会通过`setState`来触发刷新。到这里并没有发现与我们创建的`Rx`对象有什么关联，因为它的关联是发生在`build`的时候，`RxInterface.notifyChildren`：

```dart
abstract class RxInterface<T> {
  // _observer
  static RxInterface? proxy;

  static T notifyChildren<T>(RxNotifier observer, ValueGetter<T> builder) {
    final oldObserver = RxInterface.proxy;
    // 进行赋值
    RxInterface.proxy = observer;
    // result实际是一个widget
    final result = builder();
    // 如果不能更新，直接抛异常
    if (!observer.canUpdate) {
      RxInterface.proxy = oldObserver;
      throw ...;
    }
    // 替换回来
    RxInterface.proxy = oldObserver;
    return result;
  }
}
```

这里可以看到，在构建的组件的时候，会先通过`RxInterface`将它的静态属性`proxy`替换成我们的`Obx`中创建的`_observer`，然后执行`build`进行构建，然后在判断是否能够更新（是否用到了`Rx`对象），最后再将`proxy`替换回来。

也就是说实际上到这里我们还是没有将`_observer`与`Rx`对象进行关联的，但是在`notifyChildren`这个方法中的流程：替换`proxy`->`build`->检测是否可更新->替换回老的`proxy`，其实就说明了关联的过程肯定是在`build`中的，不然不会再执行完`build`后就去检测是否能更新的。

而`build`是我们构建`Obx`的时候传入的用于构建`widget`的一个函数，本身也没做什么处于，唯一和`Rx`相关的就是用到了`Rx`的值，`Obx(() => Text(controller.txt.value)),`也就是它的`value`属性。

```dart
// Rx的实现类
abstract class _RxImpl<T> extends RxNotifier<T> with RxObjectMixin<T> {
  ...
}

// 混入了NotifyManager
class RxNotifier<T> = RxInterface<T> with NotifyManager<T>;

// 实际用于观察者模式的GetStream在这里
mixin NotifyManager<T> {
  GetStream<T> subject = GetStream<T>();
  ...
}

// value是在这个混入类中引入的
mixin RxObjectMixin<T> on NotifyManager<T> {
  // value值
  late T _value;
  // 对应的get方法  
  T get value {
    // 此时的proxy正是我们Obx中的_observer
    RxInterface.proxy?.addListener(subject);
    return _value;
  }
  ...
}
```

也就是当我们构建`Obx`组件的时候，会先临时将`RxInterface`的静态属性`proxy`替换成`Obx`内部的`_observer`，然后在构建时会用到`Rx.value`，而在`get value`时会将当前的`Rx`对象的`subject`与静态的`proxy`进行关联，从而实现了它们之间的监听关系。

因此在构建完成之后，就可以检测是否能够更新（是否与`Rx`建立了联系），不能更新直接抛异常，也就是说`Obx`组件必须要在内部用到`Rx`属性。

总结：绕的比较多，不过整体来说两种方式的原理都是一样的。首先将使用状态的组件用`StatelessWidget`包一层，然后与状态进行关联，当状态发生变化时，直接`setState`触发局部组件的刷新。

### 总结

1. `Getx`使用它的依赖注入功能提供状态，子组件通过`StatelessWidget`包裹住使用状态的组件，然后向状态注册监听，当监听到变化后使用`setState`触发刷新。（`Provider`使用`InheritedWidget`提供状态并监听状态，状态变化后通知到依赖的子组件进行更新，并不是子组件直接监听状态）。
2. `Getx`依赖注入需要依赖它的路由管理，否则无法及时移除不需要的注入对象。当然也可以自定义`NavigatorObserver`来手动感知界面生命周期，从而处理不需要的注入对象。





















