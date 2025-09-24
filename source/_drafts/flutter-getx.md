---
title: Flutter强大脚手架-GetX
date: 2024-07-23 19:42:04
categories: Flutter
tags:
 - Flutter
 - GetX
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

依赖管理也是`GetX`非常重要的一部分，它与状态管理和路由管理都息息相关。它能够帮助我们管理对象的存储、构建、查找等，并且能够根据界面的生命周期自动删除对象。

如果以前没接触过依赖注入，可能理解起来比较麻烦。这里简化一下描述，可以把它当做是一个独立的存储空间，我们可以往里面存对象，或者存用于构建对象的`builder`，这样，当我们要使用这个对象时，就能直接从存储空间读取或者来生成对象。

注意，这个存储空间是非常智能的，它能够感知界面路由的变化，例如我们从`PageA`存储了一个对象，那么当`PageA`被移除出路由栈时，这个对象也会自动地从存储空间中移除。

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

其中可选参数`tag`是对象存储的标志，通过该标志存储对象并且在后续查找对象，默认是`null`。当我们不设置`tag`的时候，储存的对象的`key`会使用类名，如果设置了则使用类名+`tag`。这对于我们想要存储多个对象时非常有用，例如在`PageA`中已经存储了一个`MyGetxController`，然后跳转到`PageB`时想要一个新的`MyGetxController`，则必须设置`tag`来将其进行区分，否则我们拿到的仍是`PageA`设置的那个对象。

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

使用直接通过`Get.put`来调用即可，返回值即是第一个参数`dependency`，也就是我们设置的那个对象。（这里的注入都是在界面中注入的，实际应该在`Binding`中注入，在界面中获取。）

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

`GetX`的路由管理实际上与默认的路由管理`Navigator`区别不大，基本上也都是那些常用的方法，也是区分为匿名路由和有名路由。

想要使用路由管理，则必须将`MaterialApp`改为`GetMaterialApp`，后者的参数基本上是全部包含了前者的参数的，因此可以无缝进行修改。

### 匿名路由

匿名路由是没有名字的，因此也不需要注册路由表，如果涉及到跳转等操作，直接传入一个具体的路由界面即可。在`GetMaterialApp`中也是一样，直接通过指定`home`属性来确定第一个界面。

```dart
GetMaterialApp(
   ..
   home: HomePage(),
)
```

当然，实际中匿名路由用的是很少的，甚至是基本上不会去使用的，最主要的原因就是匿名路由的可管理性非常差。

#### to

`Get`的路由管理最大的特点就是隐藏了`BuildContext`，默认的`Navigator`需要传入`context`才能进行跳转，这也就限制了跳转界面必须要在`Widget`中，而`Get`则没有这些限制，不需要`context`意味着我们可以在任意地方进行跳转，非常灵活。当然，考虑到界面与逻辑的解耦，我们大部分情况下还是应该在`Widget`中进行跳转。

```dart
Future<T?>? to<T>(
    dynamic page, {
    dynamic arguments,
    Bindings? binding,
    bool preventDuplicates = true,
})
```

匿名路由通过`Get.to`进行跳转，该方法参数较多，这里只记录几个常用的参数。首先是必选参数`page`，注意这里的参数类型是`dynamic`，虽然没有限制具体的类型，但是在后面却有判断的，该参数支持两种类型，`Widget`类型和`GetPageBuilder`类型，推荐使用的是`GetPageBuilder`类型，为了方便对`controller`的依赖管理。

然后`arguments`是传递给下一个界面的参数，`binding`是用于依赖注入的这个前面说过了。

最后就是`preventDuplicates`，可以避免重复创建界面，默认为`true`。即当你处于`PageA`时，再去跳转到`PageA`并不会重新创建一个新的路由压入到路由栈中，类似安卓中的`singleTop`。

```dart
// 不推荐，推荐使用GetPageBuilder的方式
Get.to(SearchPage());
// 推荐
Get.to(()=>SearchPage());
// 传递参数
Get.to(()=>SearchPage(), arguments: '我可以是任意类型参数');
// 依赖注入
Get.to(()=>SearchPage(), binging: SearchBinding());
```

#### off

通过`Get.off`也可以跳转到一个新的界面，它和`to`的参数基本上是一样的，区别就是通过`off`启动新界面时会移除当前界面。例如当前从界面`PageA`通过`Get.to`跳转到`PageB`，然后再从`PageB`通过`Get.off`跳转到界面`PageC`，此时路由栈中是只有`PageA`和`PageC`的。

```dart
Get.off(()=>SearchPage());
```

#### offAll

和`off`一样，只是它会删除路由栈内所有的路由，然后在跳转到新的界面。此时，当你在新界面中返回时，由于路由栈内没有界面了，会直接退出`app`。

```
Get.offAll(()=>SearchPage());
```

#### arguments

在新界面中，可以直接通过`Get.arguments`拿到前一个界面传递的参数，这个参数就是在跳转时传入的`arguments`参数，类型也是`dynamic`的，因此可以传入任何数据。

```dart
class SearchPage extends StatelessWidget {
  SearchPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        color: Colors.green,
        child: Center(
          child: ElevatedButton(
            onPressed: () {
              // 直接获取参数即可
              print('params=${Get.arguments}');
            },
            child: Text("打印参数"),
          ),
        ),
      ),
    );
  }
}
```

### 实名路由

和`Navigator`一样，实名路由也是需要在`GetMaterialApp`中进行注册路由表的，注意在`Get`中，路由的类型实际上是一个`GetPageRoute`，在前面的匿名路由中虽然我们传入的是一个`Widget`，但最终仍是被封装成`GetPageRoute`的。

```dart
GetMaterialApp(
  ...
  // 如果在路由表中有名称为'/'的路由，可以省略这个初始值
  initialRoute: MyRouteConfig.home,
  // 路由表不用routes参数，而是getPages参数
  getPages: [
    GetPage(
       name: MyRouteConfig.home,
       page: () => HomePage(),
    ),
    GetPage(
       name: MyRouteConfig.me,
       page: () => MePage(),
    ),
  ],
);
```

在默认的`MaterialApp`中路由表是在参数`routes`中注册的，它是一个`Map`集合，通过`key`和`value`将名称与界面进行绑定。而在`GetMaterialApp`中，路由表的注册是在`getPages`中进行注册的，它是一个类型为`GetPage`的`List`集合。

我们通过`GetPage`去构建对应的界面， 它必须的参数就是名称和界面树。此外，前面说的`Binding`也是可以直接声明在`GetPage`中的。

**注意：路由名称必须以 / 开头**

#### toNamed

```dart
Future<T?>? toNamed<T>(
    String page, {
    dynamic arguments,
    int? id,
    bool preventDuplicates = true,
    Map<String, String>? parameters,
})
```

跳转方法实际上和匿名路由的名称一样，只是加了个后缀为`Named`，表示是实名路由。`page`表示的是路由的名称，直接传字符串就行，注意需要和`GetPage`中注册的保持一致。注意这里多了一个参数`parameters`，也是用于传递参数的。
```dart
Get.toNamed(
    MyRouteConfig.me,
    arguments: 'hello',
    parameters: {
        'name': '张三',
        'age' : '20'
    }
);
```

对于命名路由，除了传统的`arguments`可以传递参数外，还可以通过一个`Map`集合`parameters`来传递数据，该参数只能接受类型为`String`的参数。

```dart
print('params=${Get.arguments}， params=${Get.parameters}');
```

在目标界面中可以通过`Get.parameters`来获取到该集合参数。实际上，这个参数一般不会直接来使用，而是类似`web`跳转那样携带参数的。例如某目标界面路由地址为：`/me`，那么跳转时传递路由地址可以使用`/me?name=张三&age=20`效果是一样的。

```dart
Get.toNamed(
    MyRouteConfig.me,
    arguments: 'hello',
    parameters: {
        'name': '张三',
        'age' : '20'
    }
);

Get.toNamed(
    '${MyRouteConfig.me}?name=张三&age=20',
    arguments: 'hello',
);
```

以上两种方式的跳转是一样的，在目标界面都能通过`Get.parameters`获取到携带的数据。注意的是第一种方式直接在方法中通过`parameters`参数，在进行跳转时实际会将路由与参数进行拼接，最终变成第二种跳转方式，所以：**在路由地址中添加参数和设置parameters添加参数不能同时存在**。

除了在路由地址后通过`?`添加参数外，`Get`还支持在路由地址中使用占位符来传递参数：

```dart
GetMaterialApp(
  getPages: [
    GetPage(name: MyRouteConfig.home, page: () => HomePage()),
    // 通过冒号添加地址占位符
    GetPage(name: '/me/:uid', page: () => MePage()),
    GetPage(name: MyRouteConfig.search, page: () => SearchPage()),
  ],
);
```

在定义路由表时，就在界面的路由地址中通过占位符传递参数。

```dart
Get.toNamed(
  '/me/100',
  arguments: 'hello', 
);
```

在路由表中定义的是`/me/:uid`，而在实际跳转时需要将占位符替换成具体的数据，因此这里的跳转地址为`/me/100`。在目标界面获取参数的方式仍是`Get.parameters`拿到参数`Map`，然后通过`Get.parameters['uid']`即可获取到数据。

这种方式和直接后缀加参数的方式是可以共存的，如跳转地址为：`/me/100?name=张三`，此时通过`Get.parameters`不仅能拿到`uid`，也能拿到`name`参数。

#### offNamed

`offNamed`和`toNamed`一样，也是跳转一个新的路由界面中。区别就是会删除掉当前路由栈顶的界面，然后才跳转到新界面，类似于替换。

#### offAllNamed

删除当前路由栈中所有的路由界面，然后再跳转到新的界面。

### 回退路由

不论是匿名路由还是实名路由，跳转的返回值都是一个`Future`类型的数据，这也是为了传递数据的。在跳转的目标界面中，如果想返回到上一个界面并且传递给上一个界面参数，就可以使用`back`方法。

```dart
void back<T>({
    T? result,
    bool closeOverlays = false,
    bool canPop = true,
    int? id,
})
```

其中第一个参数就是要传递给前一个界面的数据。

```dart
// pageB
ElevatedButton(
  onPressed: () {
    Get.back('给上一页的参数');
  },
  child: Text("返回上一页"),
),
```

例如在pageB中，点击按钮会销毁当前界面，然后返回到上一个界面中去，同时给上一个界面传了一个参数。

```dart
// pageA
var params = await Get.toNamed(
    '/me/100?age=10',
    arguments: 'hello',
);
```

在`pageA`跳转的地方通过`await`等待参数。

### Middleware

`Middleware`是路由界面的中间件，可以拿到路由界面跳转过程中的各种回调，从而控制路由的跳转。

```dart
class GetMiddleware implements _RouteMiddleware {
  @override
  int? priority = 0;

  GetMiddleware({this.priority});

  @override
  RouteSettings? redirect(String? route) => null;

  @override
  GetPage? onPageCalled(GetPage? page) => page;

  @override
  List<Bindings>? onBindingsStart(List<Bindings>? bindings) => bindings;

  @override
  GetPageBuilder? onPageBuildStart(GetPageBuilder? page) => page;

  @override
  Widget onPageBuilt(Widget page) => page;

  @override
  void onPageDispose() {}

  @override
  Future<GetNavConfig?> redirectDelegate(GetNavConfig route) =>
      SynchronousFuture(route);
}
```

实际中我们需要自定义这些中间件，然后继承自`GetMiddleware`，然后重写合适的属性或方法，在这些方法中做一些处理。下面看看这些属性和方法的含义：

#### priority

优先级属性，每个路由界面是可以添加多个中间件的，执行过程则是按照`priority`进行排序执行的。该属性值越小，代表的优先级越高，越早被调用执行。

#### redirect

界面跳转，它是中间件中最早执行的方法，当我们跳转路由时`Get.to('/about')`，路由控制会去查找对应于`/about`的路由，这个方法就是在这个过程中执行的。因此我们可以通过重写这个方法，来控制跳转的界面。

```dart
class LoginMiddleWare extends GetMiddleware {

  @override
  RouteSettings? redirect(String? route) {
    // 界面对应的binding还没执行，因此UserData必须是在initialBinding中注入的
    var userData = Get.find<UserData>();
    if(userData.noLogin) {
      return RouteSettings(name: '/login');
    }
    return null;
  }
}
```

例如我们可以在这里做一些重定向拦截，首先获取到用户数据，判断用户是否已经登录，如果没有登录的话则跳转到登录界面。

注意这个方法执行的时间是非常早的，因此不要在这里使用界面对应的`binding`注入对象，而是要使用全局的`binding`注入的对象。

使用返回值来表示是否需要重定向，如果需要重定向的话，则返回一个`RouteSettings`，然后设置上对应的路由地址和参数即可，如果不需要重定向，直接返回`null`即可。

#### onPageCalled

界面被找到时调用，它是属于第二个被调用的方法，当找到了`GetPage`时回调，因此我们可以在这个方法中对界面路由做一些额外的操作。

```dart
class MyMiddleWare extends GetMiddleware {

  @override
  GetPage? onPageCalled(GetPage? page) {
    // 将所有界面都改成搜索界面
    return page?.copy(
        page: ()=>SearchPage()
    );
  }
}
```

例如在上面这个中间件中，当找到对应的路由时，将路由给重新复制了一份返回，并且将路由的界面替换成了搜索界面。对于设置了该中间件的路由，跳转后显示的都是搜索界面。

该方法主要是对界面做一些定制，如标题、参数、动效等，可以通过该中间件对界面路由做统一的定制。

#### onBindingsStart

在界面设置的依赖`Binding`执行前被调用，通过该方法，可以手动设置一些`Binding`。

```dart
class MyMiddleWare extends GetMiddleware {
  @override
  List<Bindings>? onBindingsStart(List<Bindings>? bindings) {
    var finalBindings = bindings ?? [];
    // 如果用户未登录，则加入一个注册的binding
    if (notLogin) {
      finalBindings.add(RegisterBinding());
    }
    return finalBindings;
  }
}
```

该方法就是控制界面的`bindings`的，可以在`binding`执行前来确定加入某些`binding`或者删除某些`binding`。

#### onPageBuildStart

获取到`GetPage`的用于创建界面的`builder`，这是我们在定义`GetPage`是传入的：

```dart
getPages: [
    GetPage(
       name: MyRouteConfig.home,
       page: () => HomePage(),
    ),
    GetPage(
       name: MyRouteConfig.me,
       page: () => MePage(),
    ),
  ],
```

在注册路由表的时候，需要传入两个必须得参数，一个是`name`，一个是`page`，其中`page`就是一个用于构建界面的`builder`，也就是这个函数`onPageBuildStart`的返回值。

```dart
class MyMiddleWare extends GetMiddleware {
  
  @override
  GetPageBuilder? onPageBuildStart(GetPageBuilder? page) {
    return page;
  }
}
```

这个方法其实和`onPageCalled`很像，只是粒度更加细一些。`onPageCalled`着重的是对整个`GetPage`的属性做一些定制，而`onPageBuildStart`则是针对如何构建界面这个细节上做定制。

#### onPageBuilt

`onPageBuilt`的粒度更加细，它是对已经生成的界面树再去做额外的定制。

```dart
  @override
  Widget onPageBuilt(Widget page) => page;
```

#### onPageDispose

界面销毁时的回调方法。

```dart
@override
void onPageDispose() {}
```

中间件一共有6个函数回调，它们的顺序从前往后如下：

1. `redirect`： 可以控制跳转到其他命名的路由中
2. `onPageCalled`：可以控制已经找到的目标路由的属性定制
3. `onBindingsStart`：可以手动添加或删除依赖注入的`bindings`
4. `onPageBuildStart`：可以控制用于生成界面布局的`builder`
5. `onPageBuilt`：可以定制已经生成的`Widget`树
6. `onPageDispose`：界面销毁时调用

当定义完中间件后，需要将其添加到对应的路由中，这样当其他界面需要跳转这个路由时，就会调用这些中间件了。

```dart
getPages: [
  GetPage(
    name: MyRouteConfig.me,
    page: () => MePage(),
    middlewares: [
      LoginMiddleWare(),
      OtherMiddleWare()
    ]
  ),
],
```

## 总结

`GetX`是一个非常全面的`Flutter`框架，它包含很多内容，我们常用的就是状态管理、依赖管理、路由管理这三个模块，这也是最核心的三个模块。

除此之外，还有很多其他功能。如多语言适配，它的多语言是需要创建一个单独的类继承自`Translations`，然后在其中的`keys`属性中定义我们需要的各种语言，然后在通过`Get.updateLocale`来设置语言。

但是有一些缺点，就是所有的字串都是定义在一个`Map`中，当需要适配的国家较多并且项目较大时，会导致字串总数非常膨胀，将会大量占用内存空间，因此对于国际化的适配还是选择成熟的其他的库吧。

`GetX`也支持更换主题，其实主题的更换无非就是定义各种不同的`ThemeData`然后进行替换，`GetX`也是支持这些的，可以通过`Get.changeTheme`来实现主题的替换。

同时它内置的也有网络请求`GetConnect`模块，可以快速方便的实现网络请求，当然性能上而言还是比`Dio`稍差一些的。并且，在`Flutter`中，基本上所有的项目都是用的`Dio`，就像`Android`中大家都用`OkHttp`一样，因此还是跟随主流使用`Dio`比较合适。

















