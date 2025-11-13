---
title: Flutter动画
date: 2025-01-1 22:03:47
categories: Flutter
tags:
 - Flutter
banner_img: img/cover/cover-flutter-animation.webp
---

动画也是`UI`组成的一部分，好的动画能够给用户更好的体验（动效工程师的要求，不得不做）。动画的本质其实就是一组不同的图像，连续不断的进行播放，从而体现出动态效果。例如要实现一个圆形的逐渐变大的动画效果，实际上就是将它的半径逐渐变大，然后在每一帧绘制时按照半径进行绘制就实现了。

## 动画

在`Android`中，做动画其实也是生成一组连续变化的数值，然后设置给对应的`View`，我们最常用的就是`ValueAnimator`或`ObjectAnimator`，他们本身即是动画的控制器，又是动画的执行者。而在`Flutter`中，将动画分为了两个部分：`Animatable`和`Animation`。

`Animatable`：控制动画的值，即对于动画数值的计算

`Animation`：控制动画的执行，即开始暂停等操作

### Animatable

在`Flutter`中，通过这种形式做动画的叫做补间动画，因为它的实现类就是`Tween`。它所做的，就是根据动画的进度来计算实际的值。例如需要在1秒钟之内将某个圆的半径逐渐从0扩大到60，那么对于刷新率为60帧的手机，将会在每次刷新时计算新值，也就是每16ms这个值增加1。

要实现每`16ms`计算一次，就必须要能够知道什么时候屏幕刷新，即需要一个`vsync`信号，每次收到信号后开始计算，这样对于不同屏幕刷新率的手机而言，动画也是通用的。

```dart
abstract class Animatable<T> {

  // 转换方法，根据t计算新值，t是动画的进度，值从0到1.0
  T transform(double t);

  // 根据进度获取值，与transform一样，参数是进度取值0~1，不要重写这个方法
  T evaluate(Animation<double> animation) => transform(animation.value);

  // 构建一个动画
  Animation<T> animate(Animation<double> parent) {
    return _AnimatedEvaluation<T>(parent, this);
  }
}
```

以上是摘抄的部分的`Animatable`的源码，它定义了常用的三个方法。一个是`transform`接收的是一个`double`的值，这个参数就是动画的进度。实际上的计算过程是`Animation`接收`vsync`信号触发计算，然后根据时间计算出当前动画的进度，再交由给`Animatable`计算新值。如果我们想要实现自定义的计算逻辑，只需要重写这个方法即可。

`eveluate`用于评估当前动画对应的进度的值，它的参数是一个`Animation`，实际的逻辑就是直接调用了`transform`方法。一般不要重写这个方法。

`animate`方法代表构建一个动画，它接受一个`Animation`对象，然后将二者进行组合，这样整个动画就完整了：有计算新值的`Animatable`部分，有控制动画执行暂停的`Animation`部分。

### Animation

`Animation`控制动画的执行，接收`vsync`信号，根据时间计算进度值等。

```dart
abstract class Animation<T> extends Listenable implements ValueListenable<T> {

  // 值变化监听
  @override
  void addListener(VoidCallback listener);
  void removeListener(VoidCallback listener);
  // 状态变化监听
  void addStatusListener(AnimationStatusListener listener);
  void removeStatusListener(AnimationStatusListener listener);
 
  // 动画值
  @override
  T get value;
    
  // 状态
  AnimationStatus get status;
  bool get isDismissed => status.isDismissed;
  bool get isCompleted => status.isCompleted;
  bool get isAnimating => status.isAnimating;
  bool get isForwardOrCompleted => status.isForwardOrCompleted;

  // 驱动一个Animatable
  @optionalTypeArgs
  Animation<U> drive<U>(Animatable<U> child) {
    assert(this is Animation<double>);
    return child.animate(this as Animation<double>);
  }
}
```

`Animation`实际上是一个老朋友，也是我们在状态管理中常用的`Listenable`，并且还是一个特殊的`ValueListenable`，其中的`value`也就是我们实际的动画值。

然后就是老一套添加和移除监听，比较特殊的是它还额外增加了对于动画状态的添加和移除监听。

最后是`drive`方法，翻译过来就是驱动，通过`Animation`来驱动一个`Animatable`，从而完成值的变化。看它的实现其实就是直接调用了`Animatable`的`animate`方法。

```dart
Animation<T> animate(Animation<double> parent) {
    return _AnimatedEvaluation<T>(parent, this);
}
```

就是通过`_AnimatedEvaluation`将二者合并起来：

```dart
// AnimationWithParentMixin提供了Animation的实现
class _AnimatedEvaluation<T> extends Animation<T> with AnimationWithParentMixin<double> {
  _AnimatedEvaluation(this.parent, this._evaluatable);

  // 混入类定义的参数，用于实现Animation的
  @override
  final Animation<double> parent;

  // Animatable计算新值
  final Animatable<T> _evaluatable;

  // 获取值
  @override
  T get value => _evaluatable.evaluate(parent);
}
```

虽然新的`_AnimatedEvaluation`也是继承了`Animation`，但它的实现由`AnimationWithParentMixin`混入进行实现，实现逻辑其实就是定义一个`parent`，然后方法全部由`parent`实现，类似于代理模式，即`Animation`的示例由`parent`代理实现。

而`parent`则是通过构造方法传入的，它们也没做什么，就是获取值的时候是走的`evaluate`方法。

### Tween

其实到这里整个逻辑就很清晰了，`Animation`通过调用`Animatable#evaluate`来计算新值。**也就是说`Animatable`实际上与`Android`动画中的估值器是一样的。**继续回到`Animatable`，它的一个重要实现就是`Tween`，也称为补间动画：

```dart
class Tween<T extends Object?> extends Animatable<T> {
  // 定义了开始与结束的值，通过构造方法传入
  T? begin;
  T? end;
  Tween({this.begin, this.end});

  // 计算方法
  @override
  T transform(double t) {
    // 进度为0和1的时候代表动画的开始与结束，直接返回对应的值
    if (t == 0.0) {
      return begin as T;
    }
    if (t == 1.0) {
      return end as T;
    }
    // 其他值通过lerp计算
    return lerp(t);
  }

  @protected
  T lerp(double t) {
    ...
    // 根据进度计算新值
    return (begin as dynamic) + ((end as dynamic) - (begin as dynamic)) * t as T;
  }
}
```

`Tween`定义了两个属性，`begin`和`end`代表着动画的起始值与终点值，而计算过程就更加简单了直接根据进度`t`来计算：`lerp(t) = begin + (end - begin) * t`，也就是普通的线性计算。这里注意`lerp`其实前面加了很多的`assert`，因为它是直接线性计算的，但是它的泛型又只是限定为`Object`，因此如果要想使用`Tween`，则必须传入的是实现了`+、-、*`三个操作符的对象（通常是基本变量）。否则的话，就需要继承自`Tween`然后自己实现`lerp`函数。

#### ReverseTween

`Tween`的子类之一，反转的`Tween`。

```dart
class ReverseTween<T extends Object?> extends Tween<T> {
  // 传入一个Tween
  ReverseTween(this.parent) : super(begin: parent.end, end: parent.begin);
  final Tween<T> parent;

  // 计算时将值反转
  @override
  T lerp(double t) => parent.lerp(1.0 - t);
}
```

#### ColorTween

用于实现颜色变化的`Tween`：

```dart
class ColorTween extends Tween<Color?> {
  // 限定了泛型类型为color
  ColorTween({super.begin, super.end});

  // 走的是Color的lerp，其实就是对它的RGBA通道根据进度进行计算
  @override
  Color? lerp(double t) => Color.lerp(begin, end, t);
}
```

#### SizeTween

用于实现对`Size`变化的`Tween`：

```dart
class SizeTween extends Tween<Size?> {
  // 限定泛型为Size
  SizeTween({super.begin, super.end});

  // 对Size的宽高同时根据进度进行计算
  @override
  Size? lerp(double t) => Size.lerp(begin, end, t);
}
```

#### RectTween

用于实现对`Rect`变化的`Tween`：

```dart
class RectTween extends Tween<Rect?> {
  // 限定泛型为Rect
  RectTween({super.begin, super.end});

  // 对Rect的left、top、right、bottom根据进度进行计算
  @override
  Rect? lerp(double t) => Rect.lerp(begin, end, t);
}
```

#### IntTween & StepTween

用于实现对`int`变化的`Tween`：

```dart
class IntTween extends Tween<int> {
  IntTween({super.begin, super.end});

  // 对结果值四舍五入
  @override
  int lerp(double t) => (begin! + (end! - begin!) * t).round();
}

class StepTween extends Tween<int> {
  StepTween({super.begin, super.end});

  // 对结果值取整
  @override
  int lerp(double t) => (begin! + (end! - begin!) * t).floor();
}
```

这两个`Tween`逻辑都一样，也都是取的`int`泛型，它们的区别就是一个是对结果值四舍五入，一个是对结果值取整。如果想保留原始值，则需要用`DoubleTween`（**不存在这个**，因为默认的`Tween`就可以直接传入`double`）。

#### ConstantTween

对常量做变化的`Tween`（实际上没有任何变化，这个类有什么使用场景呢？）。

```dart
class ConstantTween<T> extends Tween<T> {
  // 只接收一个参数
  ConstantTween(T value) : super(begin: value, end: value);

  // 直接返回
  @override
  T lerp(double t) => begin as T;
}
```

#### CurveTween

实现了一个曲线`Curve`的变化：

```dart
// 注意继承的是Animatable，而不是Tween
class CurveTween extends Animatable<double> {
  // 构造方法传入curve
  CurveTween({required this.curve});

  Curve curve;

  @override
  double transform(double t) {
    if (t == 0.0 || t == 1.0) {
      return t;
    }
    // 返回curve的值
    return curve.transform(t);
  }
}
```

注意这个`CurveTween`比较特殊，因为它代表的本身就是一个曲线。前面的各种`Tween`中值的变化跟进度`t`都是线性的，而`Curve`本身代表的一个曲线，或者说是一个函数，这个函数可以是线性的也可以是非线性的，具体根据它内部的`transform`实现。

但是这个`Curve`又是一个特殊的曲线，它要求当进度为0时，值为0，进度为1时，值为1。也就是说，我使用`CurveTween`时，整个值的变化肯定是从0到1，但是具体中间值如何就不一定了，可能是0到1之间的数，也可能大于1或者小于0。

### AnimationController

前面看了`Animatable`的一些实现类，其实就是各种`Tween`，它们主要逻辑就是通过进度`t`来计算出一个新值。那么回到`Animation`中，看下进度`t`是如何被获取到的。`AnimationController`就是它的一个实现类：

```dart
class AnimationController extends Animation<double>
    with
        AnimationEagerListenerMixin,
        AnimationLocalListenersMixin,
        AnimationLocalStatusListenersMixin {
  ...
}
```

`Animation`本质上也是一个泛型类，因为它是继承自`Listenable`并且实现了`ValueListenable`的。这里的`AnimationController`也可以看出，它是作为动画的控制器来实现的，因此它将泛型固定成了`double`，而这个`double`类型的值，就是它当前动画的进度。

这里先不看具体的实现，先看下它混入的三个混入类：

```dart
mixin AnimationEagerListenerMixin {
  // 注册监听者前调用
  @protected
  void didRegisterListener() {}
  // 移除监听者后调用
  @protected
  void didUnregisterListener() {}

  //回收资源
  @mustCallSuper
  void dispose() {}
}
```

第一个混入类没什么可看的，主要做的就是定义几个方法用于注册和反注册时的回调，当然它的实现全部是空实现。然后看下一个：

```dart
mixin AnimationLocalListenersMixin {
  // 存储监听者
  final HashedObserverList<VoidCallback> _listeners = HashedObserverList<VoidCallback>();

  // 这两个方法的实现在AnimationEagerListenerMixin混入类中
  @protected
  void didRegisterListener();
  @protected
  void didUnregisterListener();

  // 注册一个监听
  void addListener(VoidCallback listener) {
    didRegisterListener();
    _listeners.add(listener);
  }

  // 移除一个监听
  void removeListener(VoidCallback listener) {
    final bool removed = _listeners.remove(listener);
    if (removed) {
      didUnregisterListener();
    }
  }

  // 清空监听
  @protected
  void clearListeners() {
    _listeners.clear();
  }

  // 通知所有的监听者
  @protected
  @pragma('vm:notify-debugger-on-exception')
  void notifyListeners() {
    final List<VoidCallback> localListeners = _listeners.toList(growable: false);
    for (final VoidCallback listener in localListeners) {
      InformationCollector? collector;
      try {
        if (_listeners.contains(listener)) {
          listener();
        }
      } catch (exception, stack) 
      }
    }
  }
}
```

在`AnimationLocalListenersMixin`混入类中，实现的是监听者的注册与反注册和通知逻辑，其实就是实现的`Listenable`的逻辑。当混入这个类后，在`AnimationController`中就不需要重新实现这些逻辑了。

```dart
mixin AnimationLocalStatusListenersMixin {
  // 存储状态监听者
  final ObserverList<AnimationStatusListener> _statusListeners =
      ObserverList<AnimationStatusListener>();

  // 这两个方法的实现在AnimationEagerListenerMixin混入类中
  @protected
  void didRegisterListener();
  @protected
  void didUnregisterListener();

  // 添加状态监听者
  void addStatusListener(AnimationStatusListener listener) {
    didRegisterListener();
    _statusListeners.add(listener);
  }

  // 移除状态监听者
  void removeStatusListener(AnimationStatusListener listener) {
    final bool removed = _statusListeners.remove(listener);
    if (removed) {
      didUnregisterListener();
    }
  }

  // 清空状态监听者
  @protected
  void clearStatusListeners() {
    _statusListeners.clear();
  }

  // 通知所有的状态监听者
  @protected
  @pragma('vm:notify-debugger-on-exception')
  void notifyStatusListeners(AnimationStatus status) {
    final List<AnimationStatusListener> localListeners = _statusListeners.toList(growable: false);
    for (final AnimationStatusListener listener in localListeners) {
      try {
        if (_statusListeners.contains(listener)) {
          listener(status);
        }
      } catch (exception, stack) {
      }
    }
  }
}
```

实际上这三个混入类是共同作用的，它们实现了`Animation`中的监听者逻辑、状态监听者逻辑，以及引入了这两个监听者在添加和移除时的回调函数。通过混入类的定义，可以将`Animation`的实现拆分，使得功能界限更加清晰，提高了复用性，也可以让`AnimationController`只关注它要关注的部分。

重新回到`Animation`，它定义了内容中，处理值监听与状态监听的逻辑由混入类完成了，就还剩值处理与状态处理，以及进度的计算，这部分逻辑都是在`AnimationController`中实现的。

```dart
class AnimationController extends Animation<double> {
  
  // 构造方法传入vsync
  AnimationController({
    ...
    required TickerProvider vsync, // vsync信号
  }) : assert(upperBound >= lowerBound),
    ...
    // 构建ticker
    _ticker = vsync.createTicker(_tick);
    ...
  
  // vsync信号到达的时候触发的回调
  void _tick(Duration elapsed) {
    _lastElapsedDuration = elapsed;
    // 计算两次vsync的间隔时长
    final double elapsedInSeconds =
        elapsed.inMicroseconds.toDouble() / Duration.microsecondsPerSecond;
    // 计算进度值，进度值由_simulation计算
    _value = clampDouble(_simulation!.x(elapsedInSeconds), lowerBound, upperBound);
    if (_simulation!.isDone(elapsedInSeconds)) {
      // 更新状态
      _status = (_direction == _AnimationDirection.forward)
          ? AnimationStatus.completed
          : AnimationStatus.dismissed;
      stop(canceled: false);
    }
    // 通知观察者们进度值发生了变化
    notifyListeners();
    // 检查状态值是否变化，变化的话通知状态观察者们状态发生了变化
    _checkStatusChanged();
  }
 
}   
```

对于进度的计算，实际上就是注册`vsync`信号的监听，当`vsync`信号到达时会触发对应的回调，从而在回调中处理进度计算逻辑。这里需要通过构造方法传入`TickerProvider`实例，从而调用它的`createTicker`方法创建一个`Ticker`并传入回调方法，当`Ticker#start`时，就会进行注册，每当接收到`vsync`信号后就会触发回调方法。

`TickerProvider`的提供基本上都是通过`SingleTickerProviderStateMixin`或者`TickerProviderStateMixin`的混入来实现的，即我们正常只需要在`State`上混入这两个类中的一个就可以了。它们限定了混入的类必须是`State`类，也是基于此 ，动画通常需要在有状态组件中的`State`里面实现。

```dart
mixin TickerProviderStateMixin<T extends StatefulWidget> on State<T> implements TickerProvider {
  ...
}
```

当然，如果我们使用`GetX`框架的话，它也为我们提供了`GetTickerProviderStateMixin`和`GetSingleTickerProviderStateMixin`这两个混入类，它们限定的混入基类是`GetxController`，这样我们就可以在`Controller`中作动画的实现了。

而在回调方法中，值的计算实际上又是交由`_simulation.x()`来进行计算的。所以先看下`Simulation`：

```dart
abstract class Simulation {
  Simulation({this.tolerance = Tolerance.defaultTolerance});
  // 距离
  double x(double time);
  // 变化的距离
  double dx(double time);
  // 是否已经结束
  bool isDone(double time);
  // 存储信息，距离+时间+速度
  Tolerance tolerance;

  @override
  String toString() => objectRuntimeType(this, 'Simulation');
}
```

它是在动画开启时构建实例的，即在`AnimationController.formard()`时创建的：

```dart
class AnimationController extends Animation<double> {

  // 启动动画
  TickerFuture forward({double? from}) {
    ...
    return _animateToInternal(upperBound);
  }
    
  TickerFuture _animateToInternal(
    double target, {
    Duration? duration,
    Curve curve = Curves.linear,
  }) {
    ...
    Duration? simulationDuration = duration;
    return _startSimulation(
      // 这里创建的Simulation实例
      _InterpolationSimulation(_value, target, simulationDuration, curve, scale),
    );
  }
  ...
}
```

在启动动画的逻辑`forward`中，最终会创建一个`_InterpolationSimulation`的示例来执行动画。

```dart
class _InterpolationSimulation extends Simulation {
  _InterpolationSimulation(this._begin, this._end, Duration duration, this._curve, double scale)
    : assert(duration.inMicroseconds > 0),
      _durationInSeconds = (duration.inMicroseconds * scale) / Duration.microsecondsPerSecond;

  final double _durationInSeconds;// 时长
  final double _begin;// 开始值
  final double _end;// 结束值
  final Curve _curve;// Curve曲线

  @override
  double x(double timeInSeconds) {
    // 根据时长计算进度
    final double t = clampDouble(timeInSeconds / _durationInSeconds, 0.0, 1.0);
    return switch (t) {
      0.0 => _begin,
      1.0 => _end,
      // 根据进度计算值
      _ => _begin + (_end - _begin) * _curve.transform(t),
    };
  }

  @override
  double dx(double timeInSeconds) {
    // 1e-3
    final double epsilon = tolerance.time;
    // 取当前时间点的前后各1e-3的时间段内的进度值变化，可近似理解为速度
    return (x(timeInSeconds + epsilon) - x(timeInSeconds - epsilon)) / (2 * epsilon);
  }

  @override
  bool isDone(double timeInSeconds) => timeInSeconds > _durationInSeconds;
}
```

即在`Simulation`中，还是以时间为单位，计算进度。但这样的进度其实是属于线性进度，于是它又通过`Curve`将线性进度转换成`Curve`对应的曲线进度。到这里，能够拿到进度后，获取值就简单了，直接将进度传入`Animatable`中由其根据进度计算新值。

```dart
AnimationController({
    double? value, // 初始进度
    this.duration, // 动画时长
    this.reverseDuration, // 反转动画时长
    this.debugLabel, // 调试标签
    this.lowerBound = 0.0, // 进度下限
    this.upperBound = 1.0, // 进度上线
    this.animationBehavior = AnimationBehavior.normal,// 动画行为
    required TickerProvider vsync, // vsync信号
})   
```

在构造方法中，我们可以传入的参数非常多，都是与动画相关的，一般情况下我们只需要传`duration`时长、`vsync`提供者即可。简单总结下，`AnimationController`就是一个简单的动画控制器，它的主要作用就是监听`vsync`信号，然后在收到信号后计算进度值，所以它变化的一直都是进度值，即0~1范围内进行变化，如果想要对应到具体的值，则需要再配合`Animatable`。

#### 示例

```dart
// 定义一个动画控制器，时长2秒
final animCtrl = AnimationController(
  duration: Duration(seconds: 2),
  vsync: this,
);
// 定义一个int值变化的动画
final intAnimation = IntTween(begin: 10, end: 100).animate(animCtrl);
// 定义一个Color值变化的动画
final colorAnimation = ColorTween(
  begin: Colors.red,
  end: Colors.blue,
).animate(animCtrl);

animCtrl
  // 添加值监听，每次进度变化后都可以通过value获取值
  ..addListener(() {
      print('int = ${intAnimation.value}, color = ${colorAnimation.value}');
  })
  // 添加状态监听：dismiss,forward,reverse,complete等
  ..addStatusListener((status) {
    print('status change to ${status}');
  })
  ..forward();// 开始执行动画
```

其实在整个动画逻辑中，`AnimtionController`作为动画控制器能够响应时间的线性变化，它内部的`Curve`作为估值器来根据时间的线性变化计算出进度的变化，`Animatable`作为插值器根据进度的变化来计算出值的变化。

`AnimationController`内部的`Curve`默认是线性的，并且没有暴露给我们自定义，因此我们需要通过别的方式引入`Curve`。

### CurvedAnimation

```dart
class CurvedAnimation extends Animation<double> with AnimationWithParentMixin<double> {
  // parent是控制器
  CurvedAnimation({required this.parent, required this.curve, this.reverseCurve}) {
    ...
  }
  ...
  @override
  double get value {
    final Curve? activeCurve = _useForwardCurve ? curve : reverseCurve;
    // 拿到控制器的进度值
    final double t = parent.value;
    if (activeCurve == null) {
      return t;
    }
    if (t == 0.0 || t == 1.0) {
      return t;
    }
    // 通过curve转换
    return activeCurve.transform(t);
  }
  ...
}
```

这里只看获取`value`的方法，其实也没做什么，就是在拿到进度值后，再通过`Curve`进行转换，这样我们就可以使用自定义的`Curve`了。

#### 示例

```dart
final animCtrl = AnimationController(
  duration: Duration(seconds: 2),
  vsync: this,
);
// 注意这里定义了一个CurvedAnim
final curvedAnim = CurvedAnimation(parent: animCtrl, curve: Curves.linear);

final intAnimation = IntTween(begin: 10, end: 100).animate(curvedAnim);// 让它们与CurvedAnim关联

final colorAnimation = ColorTween(
  begin: Colors.red,
  end: Colors.blue,
).animate(curvedAnim);// 让它们与CurvedAnim关联

animCtrl
  ..addListener(() {
      print('int = ${intAnimation.value}, color = ${colorAnimation.value}');
  })
  ..addStatusListener((status) {
    print('status change to ${status}');
  })
  ..forward();
```

其实变化的部分就是在`animCtrl`之后又定义了一个`CurvedAnim`，并且其他`Animatable`直接与`curvedAnim`关联，而不是直接与`animCtrl`关联。

#### Curve

`Curve`是一个曲线类，它内部实际上定义的是一个函数，这个函数的输入`x`的取值范围是`0 ≤ X ≤ 1`，输出值`f(x)`的起点是0，终点是1，但是中间值可能会小于0或者大于1。

```dart
abstract class Curve extends ParametricCurve<double> {
  ...
  // 重点是这个方法
  @override
  double transform(double t) {
    if (t == 0.0 || t == 1.0) {
      return t;
    }
    return super.transform(t);
  }
  ...
}
```

它内部已经为我们定义了很多的`Curve`，我们可以通过`Curves`来直接使用：

```dart
[Curves.fastLinearToSlowEaseIn]
[Curves.ease]
[Curves.easeIn]
[Curves.easeInToLinear]
[Curves.easeInSine]
[Curves.easeInQuad]
[Curves.easeInCubic]
[Curves.easeInQuart]
[Curves.easeInQuint]
[Curves.easeInExpo]
[Curves.easeInCirc]
[Curves.easeInBack]
[Curves.easeOut]
[Curves.linearToEaseOut]
[Curves.easeOutSine]
[Curves.easeOutQuad]
[Curves.easeOutCubic]
[Curves.easeOutQuart]
[Curves.easeOutQuint]
[Curves.easeOutExpo]
[Curves.easeOutCirc]
[Curves.easeOutBack]
[Curves.easeInOut]
[Curves.easeInOutSine]
[Curves.easeInOutQuad]
[Curves.easeInOutCubic]
[Curves.easeInOutQuart]
[Curves.easeInOutQuint]
[Curves.easeInOutExpo]
[Curves.easeInOutCirc]
[Curves.easeInOutBack]
[Curves.fastOutSlowIn]
[Curves.slowMiddle]
```

实际上我们用这些并不多，线性的可能用的比较多一些，其他的就需要看动效工程师给我们的参数来自定义`Curve`了。

### 使用动画

其实前面的几个实例已经表明了如何去使用动画，只是没有实际应用到界面中去，这里简单展示一个用法：

```dart
// 定义一个有状态组件，这是为了混入Ticker
class MyAnimationWidget extends StatefulWidget {
  const MyAnimationWidget({super.key});

  @override
  State<MyAnimationWidget> createState() => _MyAnimationWidgetState();
}

// 在State上混入TickerProviderStateMixin，用于提供vsync
class _MyAnimationWidgetState extends State<MyAnimationWidget>
    with TickerProviderStateMixin {
  // 动画要变的属性
  double _size = 100;
  Color _color = Colors.blue;

  
  void _startAnim() {
    // 定义一个动画控制器
    final animCtrl = AnimationController(
      duration: Duration(seconds: 2),
      vsync: this,
    );
    final curveAnim = CurvedAnimation(parent: animCtrl, curve: Curves.linear);
    final sizeAnim = Tween<double>(begin: 100, end: 300).animate(curveAnim);
    final colorAnimation = ColorTween(
      begin: Colors.blue,
      end: Colors.red,
    ).animate(curveAnim);
    animCtrl
      ..addListener(() {
        // 在监听回调里，通过setState更新数据并触发重建，从而响应动画
        setState(() {
          _size = sizeAnim.value;
          _color = colorAnimation.value!;
        });
      })
      ..forward();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      // 使用状态属性
      width: _size,
      height: _size,
      color: _color,
      // 点击按钮时执行动画
      child: TextButton(onPressed: _startAnim, child: Text('Animation')),
    );
  }
}
```

这种方式属于比较底层的用法，主要就是触发动画去对状态值做一个逐渐变化的效果，然后触发刷新使界面进行响应，由此形成动画。并且，还需要在每个动画执行的地方自定义一个有状态组件，非常麻烦。而`Flutter`则帮我们内置了很多常用的组件可以让我们直接进行动画，也就是常说的隐式动画：

#### ImplicitlyAnimatedWidget

隐式动画说的就是`ImplicitlyAnimatedWidget`，其实就是将动画的执行细节封装在了内部，这样我们其实只需要传入几个关键的属性就能完成动画的执行效果，而不需要重头去写`AnimationController`、`Tween`或者`CurvedAnimation`了。

```dart
abstract class ImplicitlyAnimatedWidget extends StatefulWidget {
  const ImplicitlyAnimatedWidget({
    super.key,
    this.curve = Curves.linear,
    required this.duration,
    this.onEnd,
  });
  final Curve curve;// curve
  final Duration duration;// 时长
  final VoidCallback? onEnd;// 动画结束时的回调

  @override
  ImplicitlyAnimatedWidgetState<ImplicitlyAnimatedWidget> createState
}
```

也就是使用隐式动画实际上只需要传入`curve`和时长即可，其他的都由隐式动画组件内部进行操作。

```dart
abstract class ImplicitlyAnimatedWidgetState<T extends ImplicitlyAnimatedWidget> extends State<T>
    // 混入这个类来提供vsync
    with SingleTickerProviderStateMixin<T> {

  // 构建controller  
  @protected
  late final AnimationController controller = AnimationController(
    duration: widget.duration,
    debugLabel: kDebugMode ? widget.toStringShort() : null,
    vsync: this,
  );

  // 使用animation时，会通过_createCurve来构建
  Animation<double> get animation => _animation;
  late CurvedAnimation _animation = _createCurve();

  @protected
  @override
  void initState() {
    super.initState();
    // 初始化时添加状态监听，这是为了onEnd回调
    controller.addStatusListener((AnimationStatus status) {
      if (status.isCompleted) {
        widget.onEnd?.call();
      }
    });
    // 构建Tween
    _constructTweens();
    // 更新Tween，这个是空实现
    didUpdateTweens();
  }

  // 父组件setState时，会走到这里来
  @protected
  @override
  void didUpdateWidget(T oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.curve != oldWidget.curve) {
      _animation.dispose();
      _animation = _createCurve();
    }
    controller.duration = widget.duration;
    // 重新构建tween，如果target与tween的end值不一致，说明需要执行动效
    if (_constructTweens()) {
      forEachTween((
        Tween<dynamic>? tween,
        dynamic targetValue,
        TweenConstructor<dynamic> constructor,
      ) {
        return tween
          // 将起始值改为当前的值，这样后续执行动画就能接着执行，而不会重新开始
          ?..begin = tween.evaluate(_animation)
          ..end = targetValue;
      });
      controller.forward(from: 0.0);
      didUpdateTweens();
    }
  }

  // 根据curve构建CurvedAnimation
  CurvedAnimation _createCurve() {
    return CurvedAnimation(parent: controller, curve: widget.curve);
  }

  @protected
  @override
  void dispose() {
    _animation.dispose();
    controller.dispose();
    super.dispose();
  }

  bool _constructTweens() {
    bool shouldStartAnimation = false;
    // 调用forEachTween来构建tween
    forEachTween((
      Tween<dynamic>? tween,
      dynamic targetValue,
      TweenConstructor<dynamic> constructor,
    ) {
      if (targetValue != null) {
        // 构建Tween
        tween ??= constructor(targetValue);
        // 目标值与end值不一致，则需要重新执行动画
        if (targetValue != (tween.end ?? tween.begin)) {
          shouldStartAnimation = true;
        } else {
          tween.end ??= tween.begin;
        }
      } else {
        tween = null;
      }
      return tween;
    });
    // 是否需要重新执行动画
    return shouldStartAnimation;
  }

  // 遍历所有的Tween或者生成新的Tween
  @protected
  void forEachTween(TweenVisitor<dynamic> visitor);

  // Tween发生了变化的回调,通常在这里面将tween进行驱动
  @protected
  void didUpdateTweens() {}
}
```

所有的动画逻辑`ImplicitlyAnimatedWidgetState`进行封装，包括动画的开始与执行，界面刷新时的重新设置的处理逻辑等，如果我们需要做动效，则只需要继承它们即可。

```dart
// 构建一个用于显示和隐藏动画的组件
class VisibleWidget extends ImplicitlyAnimatedWidget {
  final bool _show; // 当前组件是否显示
  final Widget child;// 子组件

  const VisibleWidget({
    super.key,
    required super.duration,
    required bool show,
    required this.child,
  }) : _show = show;

  @override
  ImplicitlyAnimatedWidgetState<VisibleWidget> createState() {
    return _VisibleState();
  }
}

// 主要逻辑都在State中
class _VisibleState extends ImplicitlyAnimatedWidgetState<VisibleWidget> {
  // 做显示的Tween
  Tween<double>? visibleTween;
  // 组合在一块的动画
  late Animation<double> visibleAnim;

  // 遍历每一个tween
  @override
  void forEachTween(TweenVisitor<dynamic> visitor) {
    // 使用visitor参数遍历每一个tween
    visibleTween = visitor.call(
        // 原Tween，如果是空，则会使用第三个参数来构建Tween
        visibleTween,
        // Tween的目标值，如果与老的Tween数据不一致，则会更新Tween
        widget._show ? 1.0 : 0.0,
        // 构建新的Tween，注意这里构建时只传入了一个参数，这是因为要在第一次构建时能够直接
        // 显示出目标值
        (dynamic target) => Tween<double>(begin: target),
    ) as Tween<double>?;
  }
    
 
  // 在Tween更新时，将tween与animController进行关联
  @override
  void didUpdateTweens() {
    visibleAnim = animation.drive(visibleTween!);
  }
    
  @override
  Widget build(BuildContext context) {
    // 通过ListenableBuilder监听Animation的变化，它会在每次变化时刷新builder
    return ListenableBuilder(
      listenable: visibleAnim,
      builder: (_, _) {
        // 通过Opacity控制透明度
        return Opacity(opacity: visibleAnim.value, child: widget.child);
      },
    );
  }
    
  // 或者不用ListenableBuilder 
  // @override
  //Widget build(BuildContext context) {
  //   return Opacity(opacity: visibleAnim.value, child: widget.child);
  //}

  // 可以在构建Animation的时候添加监听，然后setState触发刷新 
  // @override
  //void didUpdateTweens() {
  //  visibleAnim = animation.drive(visibleTween!)
  //      ..addListener(() {setState(() {});});
  // }
}
```

这样，就定义好了一个用于做渐隐渐现的动画效果，使用起来也很简单，当然也是需要基于有状态组件的，因为它的状态仍是由外部传递进来的，而不是自己处理的：

```dart
class MyAnimationWidget extends StatefulWidget {
  const MyAnimationWidget({super.key});

  @override
  State<MyAnimationWidget> createState() => _MyAnimationWidgetState();
}

class _MyAnimationWidgetState extends State<MyAnimationWidget> {
  // 内部控制一个属性
  bool show = true;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 前面封装的组件
        VisibleWidget(
          duration: Duration(seconds: 2),
          // 传入状态值
          show: show,
          child: Container(width: 100, height: 100, color: Colors.red),
        ),
        ElevatedButton(
          onPressed: () {
            // 点击按钮时通过setState更新状态值，此时就会执行动画
            setState(() {
              show = !show;
            });
          },
          child: Text('Button'),
        ),
      ],
    );
  }
}
```

当然，其实这些基本动画的组件都被内置到`Flutter`中了，它们都是以`Animated`开头的组件，如：`AnimatedOpacity`、`AnimatedPadding`等等。

### 总结

到这里关于`Flutter`的动画部分就已经讲完了，它的核心逻辑就是`AnimationController`来接收`vsync`信号并记录当前动画应该要执行的进度值，然后通过`Tween`来定义动画的初始值和目标值，最后通过`controller.drive`或者`tween.animate`方法将二者进行关联形成一个新的`Animation`，然后就能通过读取这个新的`Animation`的`value`来获取到动画的值了。

基于此，`Flutter`还封装了很多常用的组件并且帮我们实现了对应的动画效果，使得我们可以快速使用。它们在命名上采用`Animated`开头，如`AnimatedOpacity`等，这一类的组件基本上都是封装好的带动画的组件。



