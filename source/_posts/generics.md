---
title: Java泛型
date: 2024-02-20 19:45:19
categories: Java
tags:
 - 泛型
banner_img: img/cover/cover-generics.webp
---

`Java`泛型是我们平常开发中经常遇到的，尤其是在一些框架中。使用泛型，我们可以写出通用的代码，来适配各种环境，例如可以通过泛型编码一个方法或类，使其可以接受不同类型的参数，而不需要编写各种重载方法等。

### 泛型的使用

泛型有两种使用场景，一种是泛型方法，一种是泛型类，在使用的时候通过`<T>`类进行声明，其中`T`可以换成任意字母或单词，大小写都可以，按照习惯都会将其声明为大写字母。

```java
public class Test {

    private <T> void test(T t) {
        ...
    }
    
    private <K, V> void test1(K param1, V param2) {
        ...
    }
}
```

如上是泛型方法的定义，即在方法的返回值前面通过`<T>`来声明一个泛型类型，然后在方法的参数列表和方法体中，都可以将`T`当成一个具体的类来进行使用。

```java
public void main() {
    Demo demo = new Demo();
    demo.test(demo);
    demo.test(1);
    demo.test("hello");
}
```

由于`test`方法的参数是一个泛型类型`T`，并未指定具体类型，所以在调用时可以传入任何类型的参数而不会报错。如果要使用多个泛型参数，则使用逗号隔开，如上面的`test1`方法，就声明了两个泛型类型`K`和`V`。

泛型类也是一样的，泛型类是在声明类时设置泛型类型，此时该类型可以在类中的任何地方使用。

```java
public  class Demo <T> {
    private void test(T param) {
       ... 
    }
}
```

相比于泛型方法，泛型类将泛型提取到了类的声明上去，跟在类名的后面，因此它的使用范围更大，可以在类中的任何地方使用泛型类型。而为了保证类中所有的方法使用的泛型是相同的，就需要在实例化类时就指明泛型的类型，这样在这个实例化的对象中才能保证统一。

```java
public static void main(String[] args) {
    Demo<String> d = new Demo<String>();
}
```

### 泛型上下限

在使用泛型类时，还有一种方法是通过通配符`?`来指明这个类的泛型是不可知的，这样我们就无法直接使用泛型，通过这种方式可以保证数据只能流出而无法流入。

```java
public  class Demo <T> {
    
    private T t = null;
    
    public void set(T param) {
        this.t = param;
    }
    
    public T get() {
        return t;
    }
}
```

例如上面这个就是一个普通的泛型类，有一个属性为泛型类型`T`，两个方法一个是`set`方法一个`get`方法。正常我们使用就是通过具体类型实例化一个对象，然后就可以给他设置参数和获取参数了。

```java
public static void main(String[] args) {
	// 正常使用
    Demo<String> demo = new Demo();
    // 设置参数
    demo.set("hello");
    // 获取参数
    String str = demo.get();
    System.out.println(str);
    
    // 通过？来使用
    Demo<?> demo1 = new Demo();
    // 编译报错
    //demo1.set("hello");
    // 获取的类型无法得知具体类型，只能通过Object引用
    Object obj = demo1.get();
}
```

当通过`?`来使用泛型时，意思就是不指定泛型的具体类型，因此无法调用`set`方法，因为这个方法的参数要求是泛型类型，而我们不知道是啥，因此无法传参。但是我们却可以访问`get`方法，只需要通过`Object`来进行引用即可。

那么通过`?`来使用泛型的应用场景呢？我们看下上面的实例就知道，这种使用方式限定了泛型类型的数据无法流入而只能流出，这就是使用场景。即我有一个`demo`实例，我想给你使用，但是我不想让你修改。

```java
public static void main(String[] args) {
	// 正常使用
    Demo<String> demo = new Demo();
    // 设置参数
    demo.set("hello");
    // 将demo传递给别人进行使用
}


public static void useDemo(Demo<?> demo) {
    Object obj = demo.get();
}
```

如上，我在`main`中有一个泛型类型为`String`的实例化对象`demo`，然后给他设置了参数。然后想给别人使用，但是不想给别人修改，就可以在`useDemo`的参数列表中以`Demo<?>`的类型来声明。这样，在`useDemo`方法中就只能获取而不能设置了。

那么问题又来了，使用`?`之后就只能获取而不能设置了，但是获取的类型只能认为是`Object`类型，这样即使拿到数据作用也不大。而为了避免这个问题，就又将通配符`?`进一步细化，给它一个上限和下限，分别控制数据的流入和流出。

```java
public static void useDemo(Demo<? extends String> demo) {
    String obj = demo.get();
    // 报错：还是无法设置泛型数据
    //demo.set("s");
}
```

在上面的代码中，泛型类型变成了`<? extends String>`，也就是说，泛型的这个类型虽然仍是不可知的，但是却可以知道它是`String`或者是`String`的子类，因此我们`get`方法获取到的泛型，可以直接通过`String`进行引用。这也就是上限，即限定了参数的`Demo`的泛型类型必须是`String`以及`String`的子类。

而有上限就必然有一个对应的下限，下限通过`super`关键字声明。

```java
public static void useDemo(Demo<? super String> demo) {
    // 无法得知类型，还是只能使用Object引用
     Object obj = demo.get();
  	// 但是可以设置数据
    demo.set("s");
}
```

方法的参数泛型变成了`<? super String>`，这句话的意思就是虽然泛型类型仍然是不可知的，但却可以知道它是`String`或者`String`的父类，因此可以继续往里面设置数据。

```java
class A {}
class B extend A {}

public static void useDemo(Demo<? super String> demo) {
    A a = new A();
    B b = new B();
    demo.set(a);
    demo.set(b);
}
```

我们来加深下理解，上限`<? extends String>`的意思就是这个泛型类型确定了一个上界，它只能是这个上界的子类型，因此我们可以直接可以通过`Stirng`来获取，但无法设置，因为我们不知道它的具体类型是什么。

而下限`<? super A>`的意思是泛型类型确定了下界，它只能是这个下界的父类型，因此我们不能通过`String`来引用获取到的数据，而只能通过`Object`来引用。但是我们却可以给他设置数据，只能设置`String`或者它的父类。

### 泛型继承

泛型仍然是支持继承和覆写的，对于泛型方法而言，继承后覆写仍是泛型方法，而泛型类却可以指定类型。

```java
class Parent {
    public <T> void test(T t) {}
}

class Child extends Parent {
    // 如果重写，则泛型方法仍是泛型方法
    @Override
    public <T> void test(T t) {
        super.test(t);
    }
}
```

如上面代码，在父类`Parent`中有一个泛型方法`test`，那么在子类`Child`中，如果选择覆写的话，它仍然只能是一个泛型方法，而不能改成具体类型。但是泛型类却不一样，他可以指定类型。

```java
class Parent<T> {
    public void test(T t) {}
}

class Child extends Parent<String> {
    // 如果重写，则需要将泛型T替换成具体的类型String
    @Override
    public void test(String t) {
        super.test(t);
    }
}
```

现在`Parent`是一个泛型类了，那么在子类`Child`中，继承自`Parent`是可以选择给它指定一个类型的，如果指定了类型，这里指定了`String`类型，当然也可以选择不指定，仍使用泛型类型。但是当指定了类型后，如果要重写它的方法时，必须要将泛型类型替换成指定的类型`String`。

替换后，如果想用父类引用子类，则必须提供相同的泛型类型。

```java
Parent<String> p1 = new Child();
Parent<? extends String> p2 = new Child();
Parent<? super String> p3 = new Child();
// 报错：只能是String，因为Child指定了String类型
// Parent<Integer> p4 = new Child();
```

### 泛型擦除

泛型是在`JDK5`中引入的，它并没有大量的修改字节码，而是通过编译期间进行适配，在编译期间将泛型类型移除，从而实现直接复用原来的字节码逻辑，减少了大量的修改工作。也就是说，泛型的类型检查实际上是在编译期间完成的，而非运行期间进行检查。

如下面的代码，是个泛型类，那么在编译完成之后，类中的所有的`T`都会被替换成`Object`，也就是如下所示：

```java
class Parent<T> {
    public void test(T t) {}
}

// 泛型擦除后
class Parent {
    public void test(Object t) {}
}
```

那么对于继承后指定类型的类，并且重写了带泛型的方法，则会额外生成一个指定类型的方法：

```java
class Child extends Parent<String> {
    @Override
    public void test(String t) {
    }
}

// 泛型擦除后
class Child extends Parent {
    public void test(String t) {
    }
    // 标记为ACC_BRIDGE, ACC_SYNTHETIC，无法直接访问
    public void test(Object t) {
        test((String)t);
    }
}
```

### 总结

泛型在`java`中应用还是比较多的，尤其是各种集合结构中。泛型的使用中，主要需要注意的就是它的上下限，主要控制的就是数据的暴露问题。其次就是泛型擦除问题，虽然用不到，但是面试它就总是问这个，贼烦。

