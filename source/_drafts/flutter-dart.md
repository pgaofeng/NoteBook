---
title: Flutter基础语言Dart
date: 2024-05-02 16:47:29
categories: Flutter
tags:
 - Flutter
banner_img: img/cover/cover-flutter-dart.webp
---

`Flutter`是一套跨平台方案，使用`Dart`语言设计。当已经掌握了一门开发语言之后，再去学习别的语言就是非常快的，因为基础语法基本上所有的语言都是一样的，因此只需要进行对比一下差异点就行。

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

