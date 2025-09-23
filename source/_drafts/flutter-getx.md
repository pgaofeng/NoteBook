---
title: Flutter强大脚手架-GetX
date: 2024-07-23 19:42:04
categories: Flutter
tags:
 - Flutter
banner_img: img/cover/cover-flutter-getx.webp
---

`GetX`是`Flutter`的一个三方库，属于一个微型脚手架，它提供了很多功能的解决方案。核心的三大功能是状态管理、依赖管理、路由管理，此外还有一些实用功能如翻译管理、主题管理、网络请求等，属于大而全的一类三方库。

`GetX`在[pub.dev](https://pub.dev)上的项目名是`get`，搜索时注意不要搜`GetX`，目前最新版本是`4.7.2`。

## 状态管理

声明式布局的重点就是对状态的管理，通过状态的变化来响应布局的调整。在`Flutter`中，将组件分为了两种类型，一种是无状态组件`StatelessWidget`，一种是有状态组件`StatefulWidget`。无状态组件内部不维护状态，如果需要使用到状态，则需要通过构造方法传入；有状态组件内部持有状态，当状态发生变化时，可以通过`setState`方法将状态的变化通知出去。

从`Flutter`默认的状态管理来看，实际上状态是由各个组件去进行维护的，从逻辑上来看这很合理，但是从使用以及维护上来看，这非常糟糕，尤其是在一个很复杂的界面中时，到处充斥的状态使得根本无从维护，因此一个状态管理框架就是非常必须的。

### GetxController

`GetX`的状态管理主要是通过`GetxController`来进行管理的，也就是界面相关的状态都放在`GetxController`中，此时是不需要`StatefulWidget`了，我们所有的界面都可以只使用`StatelessWidget`进行编写。

#### GetBuilder

简单状态管理，类似于`setState`一样，当状态发生变化时，使用`update`方法进行更新，而需要使用状态的地方，则需要通过`GetBuilder`去声明。例如下面的简单计数器，在控制层中有一个状态`count`记录点击的次数：

```dart
class HomeController extends GetxController {
  int count = 0;

  void clickButton() {
    count++;
    update();
  }
}
```

每次当`count`变化时，都需要通过`update`方法来通知界面进行更新。

```dart
Column(
  mainAxisAlignment: MainAxisAlignment.center,
  children: [
    GetBuilder<HomeController>(
      init: HomeController(),
      builder: (ctrl) {
        return Text("按钮点击了${ctrl.count}次");
      },
    ),
    GetBuilder<HomeController>(
     // init: HomeController(),// 可以忽略不写
      builder: (controller) {
        return ElevatedButton(
          onPressed: controller.clickButton,
          child: Text("增加计数${controller.count}"),
        );
      },
    ),
  ],
),
```

在界面的布局中，如果使用到了状态值`count`，则需要将其通过`GetBuilder`包一层，它参数有很多，主要的就是`init`和`builder`。其中`init`用作初始化创建`Controller`，注意第一次初始化之后，`GetBuilder`会将`Controller`进行存储，后续的其他的`GetBuilder`中的`init`将不会生效，也就是说它们会使用同一个`Controller`。

#### obs/Obx

除了简单状态管理外，还可以使用响应式状态管理。`GetX`为各种数据类型创建了对应的拓展属性`obs`用于将数据类型转换成`Rx`类型，我们可以很方便的使用。当使用响应式状态管理时，就不需要通过`update`去通知界面更新了，界面观测状态时会自动进行更新。

```dart
class HomeController extends GetxController {
  var count = 0.obs;
  var person = Person("张三", 20).obs;

  // 基本数据类型的Rx直接修改value即可
  void clickButton() {
    count.value++;
    // count++;
  }
  
  // 对象类型的Rx需要通过update方法修改
  void updateName(String name) {
    person.update((person) {
       person!.name = name; 
    });
  }
}
```

当使用拓展属性时，获取到的类型实际上就不再是`int`了，而是`RxInt`类型，同样的其他数据类型也是如此，都是将其包裹成了`Rx`类型的。当需要修改时，直接修改属性的`value`值即可。

```dart
Column(
  mainAxisAlignment: MainAxisAlignment.center,
  children: [
    GetX<HomeController>(
      init: HomeController(),
      builder: (ctrl) {
        return Text("按钮点击了${ctrl.count.value}次");
      },
    ),
    GetX<HomeController>(
     // init: HomeController(),// 可以忽略不写
      builder: (controller) {
        return ElevatedButton(
          onPressed: controller.clickButton,
          child: Text("增加计数${controller.count.value}"),
        );
      },
    ),
  ],
),
```

界面布局基本上是一样的，只是将`GetBuilder`替换成了`GetX`而已，而初始化参数也是一样的只会使用一次，后续其他地方的`GetX`拿到的都是同一个`Controller`。

另外，对于`Rx`类型的状态，也可以不使用`GetX`方法来使用，而可以直接通过`Obx`来进行观测。

```dart
// 需要手动创建controller
final controller = HomeController();


Column(
  mainAxisAlignment: MainAxisAlignment.center,
  children: [
    Obx(() => Text("按钮点击了${controller.count.value}次")),
    Obx(
      () => ElevatedButton(
        onPressed: controller.clickButton,
        child: Text("增加计数${controller.count.value}"),
      ),
    ),
  ],
)
```

使用`Obx`进行观测看起来更加简便，实际上项目中也基本都使用这种方式。需要注意的是通过`Obx`观测的方式没有初始化`controller`参数，因此需要自己构建`Controller`。

通过`GetX`方法进行观测，会在第一次初始化`Controller`时将其加入到依赖管理中，这样后续其他地方的`GetX`就不用初始化也能拿到`Controller`了，甚至于跳转到其他界面时也能拿到这个`Controller`对象。

而在上面的例子中是直接创建的，它并不会加入到依赖管理中去，因此在其他界面中是无法访问到这个`Controller`对象的。如果想达到同样的效果，则需要使用`Get.put`手动将其加入到依赖管理中去。

对于基本数据类型，直接通过修改`value`就可以触发状态的变化从而使界面进行变化， 而对于对象类型，修改属性的变化方式有一些不同。

### 生命周期

使用`GetxController`来管理状态，使得我们在界面不需要用到`StatefulWidget`，这可以使我们的界面布局和逻辑非常清晰，非常容易管理状态的变化。但是带来的缺点同样是无法感知到状态的生命周期了，而在`StatefulWidget`中我们是可以使用`State`类来感知生命周期的。

实际上，用于观测状态变化的组件`GetBuilder`和`GetX`都是有状态的组件，我们可以使用它们的状态来实现生命周期的感知。在它们的构造方法中，将生命周期的回调方法作为属性参数设置的。

```dart
const GetBuilder({
    this.initState,
    this.dispose,
})
    
const GetX({
    this.initState,
    this.dispose,
})
```

我们可以在构建界面时，通过传入`initState`和`dispose`方法来注册生命周期的回调，做一些初始化操作和回收操作。当然，如果使用`obs`的可观测状态时，直接通过`Obx()`进行观测就无法获取到这些状态了。因此，在`Controller`中也有对应的生命周期的方法，一般来说，我们更应该在`Controller`中处理这些变化，而不是在`GetBuidler`中处理。

```dart
class HomeController extends GetxController {

  // 界面完成后触发
  @override
  void onReady() {
    super.onReady();
  }
  
  // 组件被移除时调用
  @override
  void onClose() {
    super.onClose();
  }
  
  // 第一次被使用时触发
  @override
  void onInit() {
    super.onInit();
  }
}
```

我们可以在这些方法中处理一些初始化操作和结束时的回收操作，但是如果想要这些回调函数正常运行，必须将`Controller`加入到依赖管理中，像前面那样直接创建一个`Controller`的方式虽然可以实现状态的观测，但是无法实现这些生命周期的回调。

## 依赖管理

依赖管理也是`GetX`非常重要的一部分，它与状态管理和路由管理都息息相关。注意是依赖管理而不是依赖注入，侧重的是管理。它能够帮助我们管理对象的存储、构建、查找等，并且能够根据生命周期自动删除对象。

简单一点理解，可以把它当做是一个独立的存储空间，我们可以将各种对象保存在这个存储空间中，然后在任何使用的地方再从这个存储空间查找到对象。并且，这个存储空间能够感知界面路由的变化，例如我们在`PageA`存储了一个对象，那么当`PageA`被移除出路由栈时，这个对象也会自动地从存储空间中移除。

这对于我们的`Controller`管理是非常合适的，我们甚至可以通过这种特性来实现状态的共享，数据的共享。例如我在`PageA`中将`ControllerA`存储起来，然后跳转`PageB`后，就可以在`PageB`中查找到`ControllerA`从而拿到状态和数据。

### 添加

添加过程是依赖管理的重要部分，`Get`并不是直接帮你生成一个具体对象，而是需要我们手动生成一个对象或者提供一个生成对象的`builder`，然后将其设置给依赖管理，后续从依赖管理查询时才能找到对象或者生成对象。

#### put

```dart
  S put<S>(S dependency,
          {String? tag,
          bool permanent = false,
          InstanceBuilderCallback<S>? builder}) =>
      GetInstance().put<S>(dependency, tag: tag, permanent: permanent)
```

参数比较简单，必选参数只有一个`dependency`，还是泛型类型，也就是说我们可以存储任何类型的对象。

其中可选参数`tag`是对象存储的标志，通过该标志存储对象并且在后续查找对象，默认是`null`，当我们不设置`tag`的时候，储存的对象的`key`会使用类名，如果设置了则使用类名+`tag`。这对于我们想要存储多个对象时非常有用，例如在`PageA`中已经存储了一个`MyGetxController`，然后跳转到`PageB`时想要一个新的`MyGetxController`，则必须设置`tag`来将其进行区分，否则我们拿到的仍是`PageA`设置的那个对象。

参数`permanent`表示的是否永久存储该对象，默认为`false`表示不会永久存储，而是会自动的进行销毁，当没有地方使用该对象时，会自动将其删除。

`builder`表示构建该对象的方法，也就是说设置该参数来生成一个对象，而不是通过参数`dependency`来表示要存储的对象。在最新的`getx`的版本中，该参数已经没有用到了。

```dart
class HomePage extends StatelessWidget {
  HomePage({super.key});

  // 可以在这里直接存储对象
  final _controller = Get.put(HomeController());

  @override
  Widget build(BuildContext context) {
  	..
  }
}
```

使用直接通过`Get.put`来调用即可，返回值即是第一个参数`dependency`，也就是我们设置的那个对象。

#### putAsync

```dart
Future<S> putAsync<S>(AsyncInstanceBuilderCallback<S> builder,
     {String? tag, bool permanent = false}) async =>
  GetInstance().putAsync<S>(builder, tag: tag, permanent: permanent);
```

`putAsync`和`put`方法非常类似，参数也基本上是一样的。普通的`put`会直接将参数`dependency`作为依赖对象加入到依赖管理中，而`putAsync`则是通过`builder`来创建对象从而加入到依赖管理中，而`builder`则是返回一个`Future`类型数据，表示我们可以异步创建一个对象。

```dart
Get.putAsync(() async {
    var _controller = await HomeController.heavyInstance();
    return _controller;
});
```

它的作用就是异步设置对象，甚至在设置对象前对对象进行一些处理，尤其是这个对象的构建或者操作是比较耗时的，就可以通过这种异步方式来设置依赖对象。

#### lazyPut

```dart
void lazyPut<S>(InstanceBuilderCallback<S> builder,
      {String? tag, bool fenix = false}) {
    GetInstance().lazyPut<S>(builder, tag: tag, fenix: fenix);
}
```

懒加载对象，通过`lazyPut`设置的依赖对象并不会直接实例化，而是在实际使用时才会进行实例化。

参数也比较简单，`builder`是一个函数类型的参数，用于生成实例对象。对于懒加载的方式，在实际使用到这个依赖时才会调用`builder`来创建对象。

`tag`的意义没有变化，还是那样的用于确定依赖对象在存储空间中的存储`key`，默认为类名，设置`tag`后为`类名+tag`。

`fenix`表示的是是否支持重新重建，当设置为`true`时，生成的依赖对象仍会在不使用时被销毁，但是在需要再次使用时会重新根据`builder`生成一个实例对象。

#### create

```dart
void create<S>(InstanceBuilderCallback<S> builder,
        {String? tag, bool permanent = true}) =>
    GetInstance().create<S>(builder, tag: tag, permanent: permanent);
```

`create`类似于`lazyPut`，都是往依赖管理中注入一个`builder`，当需要对象（`find`）的时候会根据`builder`来生成一个实例对象。但区别是，`lazyPut`是在第一次`find`的时候才会去创建对象，后续再`find`返回的都是同一个对象。而`create`则是在每一次`find`的时候都创建一个新的对象。

适用场景是多个相同的组件需要同时使用自己独立的`Controller`，例如列表中每个`item`都需要一个独立的`Controller`，则可以通过`Get.create`来进行实例化的注册，然后在`item`的构建中通过`find`获取实例。

```dart
ListView.builder(
    itemCount: list.length,
    itemBuilder: (index) {
        return CustomItem(
        	controller: Get.find<ItemController>(),
            data: list[index]
        )
    }
)
```

又或者类似于商品详情页，在商品详情页中点击推荐商品跳转到另一个商品详情页，此时两个详情页的`Controller`应该是需要独立存在的，此时也比较适用`create`。

### 查找

查找时比较重要的方法，同时也只有一个方法，不论是通过`put`还是`lazyPut`或者`create`设置的对象，都统一使用`find`的方式从依赖管理中获取到对象。

#### find

```dart
S find<S>({String? tag}) => GetInstance().find<S>(tag: tag);
```

通过前面四种方式注入的对象，使用都是通过`find`方法来查找的，参数就只有一个可选的`tag`，如果在前面`put`是传入了对应的`tag`，则在查找时也应该传入相同的`tag`。

注意：使用`find`前务必要保证已经通过如`put`等各种方式添加过依赖对象了，否则会直接抛出异常。

### 删除

删除部分是对依赖对象的管理，实际上我们并不需要主动去进行管理，因为默认情况下依赖管理就能根据界面的生命周期来主动的将不再使用的对象进行删除，当然这必须要配合路由管理。

#### delete

```dart
Future<bool> delete<S>({String? tag, bool force = false}) async =>
   GetInstance().delete<S>(tag: tag, force: force);
```

删除某个依赖对象，实际上我们不需要通过这种方式去删除，基本上我们`put`的对象都是会根据使用情况来自动进行删除的，即当没有地方使用这些对象时，它们会自动从依赖管理中删除。

参数有两个，一个是`tag`用于查找依赖对象，一个是`force`表示是否删除设置了`permanent:true`的对象，因为默认情况下`permanent:true`表示永久保留在内存中。

返回值表示是否删除成功，注意这是一个异步的操作。

```dart
bool success = await Get.delete<HomeController>();
```

#### deleteAll

```
Future<void> deleteAll({bool force = false}) async =>
   GetInstance().deleteAll(force: force);
```

删除全部对象，参数`force`一样的，表示是否连`permanent:true`的对象一起删除掉。该操作也是一个异步操作，但是返回值为`void`。

#### replace

```dart
void replace<P>(P child, {String? tag})
```

替换一个依赖对象，例如前面通过`put`添加了一个对象到依赖管理中，后面想要将这个对象进行替换就可以使用这个方法。

依赖管理涉及的方法基本上都是这些了，主要包括加入对象，查找对象，删除对象。对于依赖管理实际上就是我们往管理中设置一个对象，或者设置一个创建对象的`builder`，然后在使用时查找到我们设置的对象或者通过`builder`去生成一个对象。

之所以使用依赖管理，主要是它可以实现生命周期的感知以及作用范围的共享。例如在`PageA`中`put`了一个对象，当跳转到`PageB`时仍可以拿到这个对象从而实现共享。例如再次跳转到`PageC`时，并且通过`Get.offAll`方式跳转的，此时`PageA`和`PageB`都会被销毁掉，同时在`PageA`中的时候`put`的那个对象也会自动进行销毁，而不需要我们手动管理。

### Binding

前面了解了依赖管理的一些相关方法，主要就是`put`和`find`用来设置对象和查找对象，那么问题就在这里，我该什么时候去设置对象，什么时候去查找对象。

```dart
class HomePage extends StatelessWidget {

  HomePage({super.key});

  final controller = Get.put(HomeController());

  @override
  Widget build(BuildContext context) {
    ...
  }
}
```

普通的`put`，由于它的返回值就是对应的依赖值，因此可以定义在界面类的属性中，从而在`build`方法中直接使用。但对于其他的一些设置方法呢，例如`lazyPut`、`create`等，它们实际上注入的都是一些`builder`，而在实际进行`find`时才会创建对象。

```dart
class HomePage extends StatelessWidget {

  HomePage({super.key}) {
    Get.lazyPut(()=> HomeController());
  }

  @override
  Widget build(BuildContext context) {
    final controller = Get.find<HomeController>();
    ...
  }
} 
```

可能会如上述方式在构造方法中注入，然后在`build`方法中获取，但是这样会带来很严重的性能问题，因为`build`方法在每次状态发生变化时都会触发。

`Binding`就是为了解决这个问题的，即解决依赖注入的入口点，它是与界面进行绑定的，也就是需要在`GetPage`中进行配置。这里涉及到`GetX`的路由管理，后面再具体看，现在只需要知道`GetPage`就代表着一个路由就行。

```dart
abstract class Bindings {
  void dependencies();
}
```

它是一个抽象类，我们需要实现它的`dependencies`方法，在该方法中注入相应的依赖实例。

```dart
class HomeBinding implements Bindings {
  @override
  void dependencies() {
    Get.put(HomeController());
    Get.lazyPut(() => Person('default', 20));
  }
}
```

然后将其定义在界面路由上面：

```dart
void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // 将MaterialApp改为GetMaterialApp
    return GetMaterialApp(
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
      ),
      initialRoute: MyRouteConfig.home,
      // 删除路由表，使用getPages替代
      getPages: [
        // 每个路由通过GetPage声明
        GetPage(
          // 路由地址
          name: MyRouteConfig.home,
          // 界面Widget
          page: () => HomePage(),
          // binding
          binding: HomeBinding(),
        ),
        GetPage(name: MyRouteConfig.me, page: () => MePage()),
        GetPage(name: MyRouteConfig.search, page: () => SearchPage()),
      ],
    );
  }
}
```

通过这种方式，当我们跳转到`HomePage`时，`Get`会自动应用我们给界面设置的`HomeBinding`，因此在界面中我们什么都不用管，直接通过`Get.find`获取对应的实例即可。

```dart
class HomePage extends StatelessWidget {

  HomePage({super.key});
  // 直接find即可，注入的地方都在binding中
  final controller = Get.find<HomeController>();

  @override
  Widget build(BuildContext context) {
    ..
  }
}
```

通过这种方式，将依赖的注入点全部迁移到了`Binding`中，然后将其设置给对应的界面从而完成注入的绑定。如果你不想写多个`Binding`，那么可以直接使用`BindingBuilder`来直接创建。

```dart
getPages: [
  GetPage(
    name: MyRouteConfig.home,
    page: () => HomePage(),
    binding: BindingsBuilder(() {
      Get.put(HomeController());
      Get.lazyPut(() => Person('default', 20));
    }),
  ),
  ...
],
```

这种方式不需要单独写一个类来实现`Bindings`，直接通过`BindingBuild`的构造方法，传入依赖的方法即可，如果依赖的注入方法比较多的话，可能会造成路由表看起来比较乱，至于选择何种方式就仁者见仁了。

另外，如果只需要注入一个对象的话，可以直接通过`BindingBuilder`的工厂构造方法来设置了，非常的简便。

```dart
getPages: [
  GetPage(
    name: MyRouteConfig.home,
    page: () => HomePage(),
    binding: BindingsBuilder.put(()=>HomeController()),
  ),
  ...
],
```

通常对应于简单界面的`Binding`注入，因为简单界面基本上也只需要一个`Controller`来控制状态了，而这个工厂构造方法实际上就是手动去帮我们进行`put`了。

```dart
factory BindingsBuilder.put(InstanceBuilderCallback<T> builder,
      {String? tag, bool permanent = false}) {
  return BindingsBuilder(
    () => GetInstance().put<T>(builder(), tag: tag, permanent: permanent));
}
```

如果有多个`Binding`想注入到同一个路由界面时，可以使用`bindings`属性，它接收的是一个集合类型，可以通过这个属性设置多个`Bindings`。

```dart
getPages: [
  GetPage(
    name: MyRouteConfig.home,
    page: () => HomePage(),
    bindings: [
      HomeBinding(),
      CommonBinding(),
      ...
    ],
  ),
  ...
],
```

对于想要全局注入的对象，可以使用`initialBinding`来进行注入。

```dart
return GetMaterialApp(
  initialRoute: MyRouteConfig.home,
  // 全局注入，所有界面都可以使用注入的对象
  initialBinding: GlobalBinding(), 
  getPages: [
    ..
  ],
);
```

全局注入的对象是不会跟随界面的声明周期而变化的，会一直保留在内存中，通常需要全局存在的对象才在这里进行注入。

### GetView/GetWidget

如果需要注入的对象只有`Controller`，则可以通过继承自`GetView`来快速获取`Controller`，而不需要手动进行`find`。

```dart
abstract class GetView<T> extends StatelessWidget {
  const GetView({Key? key}) : super(key: key);

  final String? tag = null;

  T get controller => GetInstance().find<T>(tag: tag)!;

  @override
  Widget build(BuildContext context);
}
```

其本质上就是一个`StatelessWidget`，只是帮我们主动进行`find`而已，因此对于只需要单个`Controller`的组件，直接继承它就行了。

```dart
class HomePage extends GetView<HomeController> {

  // 构造函数也能设置为const了
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    // 可以直接访问controller
  }
}
```

注意这里的`controller`是一个泛型类，并且没有具体的限制，因此它虽然名字叫做`controller`，但它可以是任意类型。

`GetWidget`也可以快速访问`controller`，但是注意，它的泛型`controller`被限制了类型为`GetLifeCycleBase`，因此它可以说是一个正常的`controller`，而不是像`GetView`那样的任意类型。

```dart
abstract class GetWidget<S extends GetLifeCycleBase?> extends GetWidgetCache {
  const GetWidget({Key? key}) : super(key: key);

  @protected
  final String? tag = null;

  S get controller => GetWidget._cache[this] as S;

  // static final _cache = <GetWidget, GetLifeCycleBase>{};

  static final _cache = Expando<GetLifeCycleBase>();

  @protected
  Widget build(BuildContext context);

  @override
  WidgetCache createWidgetCache() => _GetCache<S>();
}
```

与`GetView`不同的是，它内部使用了一个缓存来储存`controller`实例，这是专门针对于使用`Get.create`进行注入的依赖所使用的组件，通过缓存保证在实例的声明周期内只会`find`一次，并且当组件销毁时也会将实例进行销毁。

```dart
// 泛型类型必须要是GetLifeCycleBase类型
class HomePage extends GetWidget<HomeController> {
  // 可以将构造方法const了
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    // 可以访问controller
  }
}
```

`GetView`和`GetWidget`都是为了简化`controller`的获取的，能够使得我们不需要手动去`find`对应的实例，而是直接使用。

## 路由管理



















