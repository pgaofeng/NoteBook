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

#### 路由跳转

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









### Dart

`Dart`作为强类型语言，和`Java`的语法基本上是一致的，然后又和`Kotlin`也差不多，感觉类似于二者的混合。

#### 属性声明

属性声明和`Java`一样，类型在前数据名称在后，结尾带分号。但是也可以省略类型，此时会自动推断类型，和`Kotlin`一致。同时也支持空类型。

```dart
int a = 1; 
int? b = 2; // 可空类型，可以赋值为null

var c = "text";// 类型为String
final d = "text1";// 类型为String
String e = "text2";

// 非空的属性必须设置初始值，否则需要通过late声明延迟初始化
late int f;
```

#### 作用域

`Dart`中没有`public`、`private`这种访问属性，默认就是`public`的，如果想要设置为私有的，则只需要在方法名或者属性名或类名前加`_`即可。

```dart
class _Test {
    int _number = 10;
    void _test() {}
}
```

如上声明了一个私有类，内部有一个私有属性和私有方法，这里的私有作用域是声明类的这个文件。在同一个文件内是可以随便访问的。

#### 函数参数

函数类型分为必选参数、可选参数、命名参数。这和`Kotlin`中的函数参数差不多，`Kotlin`中函数参数不加默认值的话就属于必选参数，并且所有参数都属于命名参数。但是在`Dart`中将二者进行了区分。

```dart
void _test(int number, [String sex = "男"] ) {

}
```

普通参数放在前面，可选参数放在后面，并使用中括号括起来，并且可选参数必须要有默认值。

```dart
void main() {
  _test(10);
  _test(10, "女");
}
```

调用时不传可选参数会使用默认的值。

```dart
void _test(int number, {required String sex, bool child = false} ) {

}
```

命名参数同样放在普通参数后面，命名参数必须提供默认值，如果不提供默认值的话类型必须是可空的，此时会自动使用`null`作为默认值，如果不可空并且不提供默认值，则需要使用`required`来表明该参数是必选的。

```dart
void main() {
  _test(10, sex: "女");
  _test(10, sex: "女", child: true);
}
```

注意在传命名参数时，必须要带上参数的名称，如`sex`和`child`名称，普通参数不需要带。**一个函数中不能同时出现可选参数和命名参数**。

#### 构造函数

```dart
class Person {
  int _age = 0;
  String _name = '';
  Demo(int age, String name) {
    this._age = age;
    this._name = name;
  }
}
```

注意，普通构造函数和`Java`一样，但是只能存在一个构造函数，不能重载。像这种基础的赋值操作，可以在构造函数中进行简化。

```dart
class Person {
  // 这里非空属性也不需要默认值了
  int _age;
  String _name;
  // 当调用构造函数时，会自动进行赋值
  Person(this._age, this._name);
}
```

通过在构造方法中使用`this._age`形式，构造对象时可以直接给`_age`赋值，并且声明该非空属性的地方也不需要设置默认值了，另外，如果不需要做其他操作的话，方法体也可以直接省略了。

```dart
class Person {
  int? age;
  String? name;
  // 如果是命名参数，不能是私有的
  Person({this.age, required this.name}) {}
}
```

同样的，构造函数的参数也可以是命名参数，但是命名参数不能是私有参数，私有的只能作为普通参数存在。

```dart 
class Person {
  int? age;
  String? name;
  Person(this.age, this.name);
}

class Man extends Person {
  Man(int age, String name): super(age, name);
}
```

对于继承类，需要在构造方法后面调用`super`，而不是在方法体中调用。当然也可以继续简化。

```dart
class Man extends Person { 
  Man(super.age, super.name);
}
```

直接在构造参数中通过`super.age`的方式给父类注入参数，这样就不需要单独调用`super()`方法了。另外，如果还有额外的参数不想通过构造方法注入的话，可以直接在构造方法的后面给他赋值。

```dart
class Man extends Person { 
  Stirng sex;
  Man(super.age, super.name): sex = '男';
}
```

注意只有自己的参数才能在构造函数的后面赋值，父类的参数只能在构造方法参数中赋值或者`super`方法中赋值。

命名构造函数，可以设置多个，通过名称来进行区分需要构造什么样的对象。

```dart
class Person {
  int? age;
  String? name;
  Person(this.age, this.name);
  // 命名构造函数
  Person.adult(this.name): age = 18;
  Person.child(this.name): age = 10;
}
```

命名构造函数实际上就是分不同的场景去创建不同的对象，例如上述例子中的`Person`的命名构造函数中，只需要传入`name`，而`age`则根据不同的场景设置为不同的值，处理不同的初始化逻辑等。

工厂构造方法，可以控制对象的创建过程，可以说工厂构造函数更类似于`Java`中的静态方法，本身并不是对象的构造函数，而是提供对象的工厂函数。

```dart
class Person {
  int? age;
  String? name;

  Person(this.age, this.name);

  // 声明一个工厂构造方法，每次调用返回一个新的实例
  factory Person.newPerson(int age, String name) {
    return Person(age, name);
  }
  
  // 声明一个工厂构造方法，每次调用返回同一个实例
  static Person? _instance;
  factory Person.defaultInstance() {
    _instance ??= Person(10, '默认');
    return _instance!;
  }
}
```

#### getter/setter

除了可以和`Java`一样通过编码两个普通函数实现`getter`和`setter`外，`Dart`还支持对应的关键字来实现。

```dart
class Person {
    int _age;
    Person(this.age);
    
    int get age => _age;
    set age(int age) => _age = age;
}
```

对于私有属性`_age`，通过`get`关键字声明了一个`age`访问属性，进而可以访问到`_age`的值。另外也通过`set`关键字声明了一个`age()`方法来设置值。

```dart
void main() {
	final person = Person(10, "ja");
    // 通过age进行访问
    print('age=${person.age}');
    // 通过age进行设置
    person.age = 20;
}
```

#### 拓展方法

和`Kotlin`一样，`Dart`也允许为某一个类拓展出不同的方法和属性，通过关键字`extension .. on ..`实现。

```dart
extension PersonExt on Person {
  // 给_name拓展一个name的访问属性
  String get name => _name;
  set name(String name) => _name = name;
  
  // 拓展一个打印方法
  void printPerson() {
    print("age=$_age, name=$_name");
  }
}
```

拓展方法在使用上和普通方法是一样的，直接通过对象进行调用即可。

```dart
void main() {
  final person = Person(10, 'ja');
  // 虽然Person定义里没有这个方法
  // 但是经过拓展后还是可以调用到这个方法
  person.printPerson();
}
```

注意，上面的拓展方法中用到了类的私有属性，这是因为他们定义在了同一个文件中，如果不是同一个文件的话，是无法访问到它的私有属性的。

#### implements

`Dart`也是单继承的语言，同样也是使用的`extends`关键字。另外，它没有接口类，但它能把普通类当做接口类来`implements`，不论这个类是普通类还是抽象类，而且还支持多实现。

```dart
// 普通类
class Person {
  int _age;
  String _name;
  Person(this._age, this._name);
  void test() {}
}

// 抽象类
abstract class User {
    void say();
}

// 实现普通类时，需要同时重写属性和方法
class Woman implements Person, User {
  @override
  int _age = 10;

  @override
  String _name;
  
  Woman(this._age, this._name);

  @override
  void test() {
  }  
    
  @override
  void say() {
  }
}
```

当继承(`extends`)一个类时，能够继承它的方法属性以及对应的逻辑，而当实现(`implements`)一个或多个类时，需要重写属性和方法，相当于只保留了它们的声明，而丢弃了实现。

#### 混入

`Dart`中用`mixin`表示一个功能，该功能可以混入到类中，也就是将某个具体方法逻辑的实现抽取出来，作为一个`mixin`，然后添加给想要该功能的类。

有点像`kotlin`的代理。

```kotlin
// kotlin中描述某个功能的接口
interface Fly {
    fun fly()
}

// 对该功能实现的类
class FlyImpl : Fly {
    override fun fly() {
        print("fly")
    }
}

// 通过by代理，可以使该类具有Fly接口的功能，而不用在
// 类中重新实现
class Birds: Fly by FlyImpl() {
    
}
```

而在`Dart`中则是通过混入实现的：

```dart
// Dart中描述某个功能的混入类
mixin Fly {
  void fly() {
    print("fly");
  }
}

// 通过with，是该类具有Fly的功能，而不用
// 在该类中重新实现
class Birds with Fly {}
```

通过`with`关键字，在声明类时将`Fly`混入类给加入到`Birds`中，这样就不需要在该类中重新写一遍具体的实现了。

而混入类比`Kotlin`代理更强的一点是，它可以指定在某个类上混入，从而可以访问这个类的属性和方法。

```dart
// 普通的基类Person
class Person {
  int age;
  String name;
  Person(this.age, this.name);
}

// 混入类通过on关键字，指明该混入只
// 能用在Person的子类上
mixin Speak on Person {
  void speak() {
    // 可以访问到Person的属性
    print("my name is $name, age is $age");
  }

  // 也可以混入一个属性
  String language = "chinese";
}

// Person的子类可以混入Speak
class Man extends Person with Speak {
  Man(super.age, super.name);
}
```

即在声明混入类时，通过`on`关键字指明该混入类只能作用在具体的类的子类上，这样其他类就无法应用该混入类了，与此同时该混入类中也能访问到类的属性和方法了。

### 总结

有了一门编程语言基础后，再去学另一门语言是非常快的，因为大部分语言都是相通的，只需要关注一下它们的不同之处即可。就像在已经掌握了`Java`和`Kotlin`之后，再去学`Dart`就发现非常容易，因为`Dart`中的概念在`Java`和`Kotlin`中都有，无非就是实现方式不一样而已。

