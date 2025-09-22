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

  void clickButton() {
    count.value++;
    // count++;
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

## 依赖管理



















