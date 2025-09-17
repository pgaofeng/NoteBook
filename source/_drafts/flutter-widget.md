---
title: Flutter基础组件
date: 2024-04-17 22:03:47
categories: Flutter
tags:
 - Flutter
banner_img: img/cover/cover-flutter-1.webp
---

`Flutter`是一套跨平台方案，使用`Dart`语言设计，作为移动开发者的我们基本上是必须要掌握这些技能的。既然是一套`UI`框架，那么我们在学习时也是需要从它内置的一些基础组件开始学习。只有先掌握了基础组件，才能在后续中把握更加复杂的页面布局和自定义布局。

### Widget

在`Android`中，所有的组件都是`View`，对于复杂的布局也是通过`ViewGroup`进行组合的。而`Flutter`也是如此，只是`Flutter`对于组件更加细化，例如`padding`在`Android`中只是`View`的一个属性，而在`Flutter`中则被抽象成一个组件，这点和`Compose`是一样的。

#### Text

```dart
const Text(
    String this.data, {
    this.style,
    this.textAlign,
    this.softWrap,
    this.overflow,
    this.maxLines,
  })
```

 通过参数控制文本的行为，参数较多，这里只列出了常用的几个。其中最主要的就是`data`属性，也是必填参数，这是文本组件的文本内容。其他的是几个可选参数，如`style`参数，类型是`TextStyle`，可以通过它来设置文本的颜色，背景色，字体，字重，字体大小等等，它涉及到的都是文本的描述属性。其他属性如`textAlign`，类型为`TextAlign`枚举，用于控制文本的对齐方式，`softwrap`是否自动换行，默认自动化行；`overflow`文本超过限制后的行为属性，可以设置为剪切、渐变、打点等；`maxLines`最大行数。

```dart
Text("hello worldhello worldhello worldhello world",
  style: TextStyle(
    color: Color(0xFF00FF00),
    fontSize: 50
  ),
  softWrap: true,
  maxLines: 2,
  textAlign: TextAlign.end,
))
```

#### Image

```dart
const Image({
    super.key,
    required this.image,    
    this.width,
    this.height,
});
```

`Image`作为图片显示的组件也是非常重要的，这里我们先简单关注下它的一些属性，在其构造方法中，需要注意的就是三个属性，一个是`image`，另外两个是宽高。其中`image`是一个`ImageProvider`类型， 用于提供图片，当然实际上我们很少会直接通过这种方式去创建一个图片显示，而是通过它的命名构造方法去进行创建。如`Image.asset`、`Image.memory`、`Image.file`、`Image.network`等，这些方法相比于直接通过默认构造方法，就是提供了`image`属性，也即是提供了对应的`ImageProvider`的实现类。

```dart
Image.asset("images/head.jpg", width: 100, height: 100)
```

#### Icon

`Icon`作为小图标，实际上和`Image`一样都是用来显示一个图片的，只是`Icon`更倾向于作为一个小图标，如点赞的爱心或拇指等这种svg小图标。

```dart
const Icon(
  this.icon, {
  super.key,
  this.size,
  this.color,
})
```

其实最主要的也就是这几个属性了，首先是`icon`必传属性，类型是一个`IconData`类型，也即是显示的那个图标的数据。其次是`size`属性控制其大小，注意`Icon`的宽高是一致的，不需要单独设置宽高。`color`则是图标的颜色，可以通过代码控制颜色。

在`Flutter`中默认会内置一些`material`的`icon`资源，如果我们想用这些资源的话，可以直接通过`Icons`来使用，例如下面：

```dart
Icon(
    Icons.add_circle, 
    size: 300, 
    color: Color(0xFF00FF00),
)
```

当然，默认内置的这些`Icon`肯定是无法满足我们实际的项目需求的，因此我们可以引入自定义的一些`Icon`，这种引入方式实际上就是通过字体`ttf`引入，通过将`Icon`打包到`ttf`中，然后在使用的时候通过设置`IconData`来访问。

```dart
Icon(
    IconData(
        0xe13d, // icon的代码
        fontFamily: 'customfont',
    ),
    size: 300, 
    color: Color(0xFF00FF00),
)
```

唯一需要注意的就是在`IconData`的参数中的第一个参数，它代表的是图标的代码，这是在构建`ttf`文件时就已经确定的。

#### ElevatedButton

`Flutter`中内置了好几种的按钮类型，可以根据需要进行选择，它们的用法基本上是一致的，只是样式有所不同。如`ElevatedButton`，是一个悬浮按钮，即默认看起来是悬浮的，有阴影效果和圆角效果。

```dart
ElevatedButton({
    super.key,
    required super.onPressed,
    super.onLongPress,
    super.onHover,
    super.onFocusChange,
    super.style,
    required super.child,
})
```

其中`onPressed`参数接收一个空参的函数类型，作为点击事件的回调，属于必须添加的属性，在安卓中这种事件一般被称为`onClick`。另外还有一个长按的回调，`onLongPress`也是一个空参数的函数类型。`onHover`鼠标悬停时的回调，是一个`bool`参数的函数类型。`onFocusChange`是焦点发生变化时的回调。

然后就是`style`，它是控制整个按钮样式的属性，类型为`ButtonStyle`，可以通过它来设置按钮的背景色、前景色、阴影、圆角、高度、间距、形状等等。在我们实际的开发中，按钮的样式肯定是不会和默认保持一致的，因此我们需要重新设置`style`以适配我们自己项目的按钮样式。

还有一个必填的属性就是`child`，一般情况下我们会将其设置为`Text`，即按钮中间的文本。也就是说，按钮实际上是由两部分组成，一部分是外部的按钮样式（边框圆角等），一部分是内部的文案（按钮文案等）。

```dart
ElevatedButton(
  onPressed: () {
    // onPressed
  }, 
  child: Text("Button")
),
```

另外还有别的按钮类型，它们都是继承自`ButtonStyleButton`，参数也都是一样，连用法都是一模一样，区别就是样式不同。而样式都是通过`style`属性控制的，所以大致了解下就行，毕竟实际项目中我们肯定会自定义按钮样式的。

`FilledButton`：在`ElevatedButton`的基础上去除了阴影，背景使用主题色填充。

`OutlinedButton`：在`FilledButton`的基础上移除了背景，但是添加了边框。

`TextButton`：在`OutlinedButton`的基础上移除了边框。

另外这些按钮组件，还提供了一个带`Icon`的样式的按钮，通过它的命名构造函数`icon`来创建。

```dart
FilledButton.icon(
  onPressed: () {
    // onPressed
  },
  onLongPress: () => {  },
  icon: Icon(Icons.add),
  label: Text("Button")
),
```

注意，通过`.icon`创建的按钮，参数的变化。首先多了一个`icon`参数，但不是必须的。然后就是原本按钮的`child`属性，改名为`label`属性，当然实际上类型没变。通过这种方式设置的按钮，会在文本的前面加上一个`icon`图标。

除了上面的几个同系列的按钮外，还有别的类型的按钮，只是它们不是同一个子类，所以可能参数上会有一些不同。

`IconButton`：将`icon`变成一个按钮。

```dart
IconButton(
  onPressed: () {},
  icon: Icon(Icons.add)
)
```

而继承自`IconButton`的按钮，还有`BackButton`、`CloseButton`、`DrawerButton`等，实际上就是传入了不同的`Icon`而已。

#### CheckBox

```dart
Checkbox({
    super.key,
    required this.value,
    this.tristate = false,
    required this.onChanged,
})
```

选择框实际中我们也应用的挺多的，`CheckBox`组件就是一个选择框，主要的就是三个属性，其中两个是必选属性。

`value`是一个可空的布尔值类型`bool?`，值为`false`表示未勾选，值为`true`表示已勾选，值为`null`表示部分勾选。

`tristate`：是否支持三态模型，即部分勾选。默认为`false`。

`onChanged`：当点击选择框时的回调。

其他属性比较多，可以充分进行自定义，如设置颜色、形状、圆角、水波纹等等，我们可以基于此来设置一些属性以符合项目需求，但大部分情况下是无法符合的，通常需要我们去自定义。

和它类似的还有一个`Switch`组件，即开关组件，当然大部分情况下也无法满足我们的项目样式需求，也是需要进行自定义的。

#### TextField

输入框也是我们用的非常多的一个组件，用于文本的输入。它的构造方法参数也是非常多的，用于控制各种行为属性，但是它并没有必选参数，下面简单看下它的常用的参数。

`controller`属性的类型是`TextEditingController`，用于控制文本的编辑的，通过`controller`可以拿到输入框的文案，以及向输入框中设置文案内容。也可以拿到输入框的选中内容，选中的位置信息等。

```dart
final _controller = TextEditingController();

Column(
  children: [
    Padding(
      padding: EdgeInsets.all(20),
      child: TextField(controller: _controller),
    ),
    FilledButton(
      onPressed: () {
        // 获取输入框内容和选中的内容的下标
        String text = _controller.text;
        int startOffset = _controller.selection.baseOffset;
        int endOffset = _controller.selection.extentOffset;
        // 设置输入框内容和选中内容
        _controller.text = "new Text";
        _controller.selection= TextSelection(baseOffset: 0, extentOffset: 2);
      },
      child: Text("文本框内容")),
  ],
),
```

`controller`除了能过设置和获取到文本外，还可以添加监听`addListener`，当输入框发生任何变化时（文本变化，光标变化等等）都会触发它的回调，非常灵活，但同时调用也会非常频繁。

`decoration`参数用于控制输入框的样式，可以设置`icon`、`label`、`hint`、`border`、以及各种颜色和前缀后缀等，通常情况下我们都需要设置这个属性，以适配项目的UI需求。

`textInputAction`文本输入内容，通常对应的是键盘的右下角，会显示成搜索图标或者完成等信息，对应安卓中是`imeOptions`。参数类型是`TextInputAction`枚举类，可以选择多种情况，常见的有`search`、`done`、`next`等等。

`textCapitalization`参数表示文本输入模式，也是一个枚举类，针对的是键盘的行为属性。设置为`none`（默认）唤起键盘后会设置成全小写输入，设置为`characters`唤起的键盘是全大写输入，设置为`words`则是每个单词的首字母大写，设置为`sentences`是每个句子的首字母大写。当然这些只针对英文输入法，切换为中文时无效。

`style`设置的输入的文本的样式，和`Text`的`style`属性一模一样。

`obscureText`设置为密码模式，设为`true`后文本默认会用`.`代替，也可以通过`obscuringCharacter`将替换文本修改为别的。

 其他还有很多属性，常用的不多了，还有一个`textAlign`表示文本的对其方式，一个`onChanged`回调方法，当文本变化时会被调用。



#### Row

基础组件中其实也就`Text`和`Image`了，其他的组件基本上都是各种组合组件，用于对其他组件进行组合的。如`Row`就是提供了一个列，允许存放多个子组件，组件水平进行排列。

```dart
const Row({
    super.mainAxisAlignment,
    super.mainAxisSize,
    super.crossAxisAlignment,
    super.spacing,
    super.children,
  })
```

构造方法也是比较简单，只有几个简单的属性。其中`mainAxisAlignment`表示的是主方向上的布局方式，是一个枚举类，可选的有`start`、`end`、`center`、`spaceBetween`等多种值，该组件为`Row`组件，所以主方向就是横向。

然后就是`mainAxisSize`，主方向上的尺寸，也是一个枚举值，可选为`max`（默认）或者`min`，当选择最大时，`Row`会在横向上填充父布局的宽度，类似于安卓中的`match_parent`，而`min`则是对应的`wrap_content`。

`crossAxisAlignment`表示的是交叉轴的对其方式，对于`Row`而言就是垂直方向上的对其方式，取值为枚举值，有`start`、`end`、`baseline`等，其中如果`Row`中的子组件为`Text`的时候，最好选择`baseline`的对其方式。

`spacing`间隔，表示的是子组件之间的间隔，注意这个间隔不包括子组件对最左侧和最右侧的间距。

`children`子组件数组，`Row`会对这个属性中的组件按照上面的规则进行排列。

```dart
Row(
  mainAxisAlignment: MainAxisAlignment.spaceBetween,
  mainAxisSize: MainAxisSize.max,
  spacing: 10,
  children: [
    Text("Hello1"),
    Text("Hello2"),
    Text("Hello3")
  ],
)
```

#### Column

`Column`组件的构造参数和前面的`Row`一模一样，它们的表现形式也是一样，只是`Row`是横向进行排列，而`Column`是纵向排列。

#### Expanded

对于`Column`和`Row`而言，实际上就类似于安卓中的`LinearLayout`的横竖两种排列方式，而`LinearLayout`还支持`weight`属性，子`View`会按照`weight`的权重来瓜分`LinearLayout`的空间。而在`Flutter`中，则是将`weight`的行为也进行抽象，变成了一个`Expanded`组件。

```dart
Expanded({super.key, super.flex, required super.child})
```

其构造方法中，`flex`对应的就是`weight`属性，也即是权重。接下来我们就可以在`Row`或者`Column`中通过`Expanded`来使其子组件瓜分父组件的宽或高了。

```dart
Row(
  mainAxisAlignment: MainAxisAlignment.spaceBetween,
  mainAxisSize: MainAxisSize.min,
  children: [
    Expanded(flex: 1, child: Text("Hello1")),
    Expanded(flex: 2, child: Text("Hello2")),
    Expanded(flex: 1, child: Text("Hello3")),
  ],
)
```

#### Spacer

除了`Expanded`外，还有一个组件也是用比例来瓜分父布局宽或高的，它就是`Spacer`。

```dart
Spacer({super.key, this.flex = 1})
```

`flex`参数同样是比例参数，`Expanded`参数是将子布局包裹起来作为一个整体，然后通过比例值进行划分。而`Spacer`则是单独自己，作为一个空间，单独按照比例进行区分。

```dart
child: Row(
  children: [
    Text("Hello1"),
    Spacer(flex: 1,),
    Text("Hello2"),
    Spacer(flex: 2,),
    Text("Hello3"),
  ],
)
```

例如上面代码，就是在三个文本显示的情况下，将`Row`的横向剩余空间分成三份，在`hello1`和`hello2`之间占一份，而`hello2`和`hello3`之间占两份。

#### Container

`Container`是一个容器组件，它只接受一个子组件，用来对子组件进行布局控制的。

```dart
Container({
    super.key,
    this.alignment,
    this.padding,
    this.color,
    this.decoration,
    double? width,
    double? height,
    this.margin,
    this.child,
})
```

参数比较多，首先就是`alignment`参数，控制的是子组件在它内部的布局位置，类型为`AlignmentGeometry`，实际中我们可以通过`AlignmentDirectional`的一些内置静态成员来进行设置，如可以设置为`AlignmentDirectional.topEnd`让子组件显示在右上角。

`padding`用于设置内边距（`margin`用于设置外边距），类型都为`EdgeInsetsGeometry`，实际设置中我们可以通过`EdgeInsets.all`或者`EdgeInsets.only`来进行设置。

`color`设置容器的颜色，或者说是背景色。`width`和`height`设置宽高。

`decoration`装饰，用于装饰子组件，类型为`Decoration`，实际使用中可以使用`BoxDecoration`或者`ShapeDecoration`。注意添加了`decoration`后不能在设置`color`。

```dart
Container(
  // 设置了decoration参数后不能设置颜色了
  //color: Color(0xFF00FF00),
  decoration: BoxDecoration(
    // 可以通过decoration来设置颜色
    color: Colors.red,
    // 设置边框，颜色为紫色，宽度为10
    border: Border.all(
        color: Colors.purple, 
        width: 10
    ),
    // 边框圆角
    borderRadius: BorderRadius.only(topLeft: Radius.circular(5)),
    // 形状
    shape: BoxShape.rectangle // 如果是circle，则不能设置borderRadius
  ),
  child: Text("Hello1"),
)
```

上面是设置的`BoxDecoration`可以设置颜色，边框等，如果是`ShapeDecoration`的话，则无法设置边框了，只能设置颜色和形状。

#### Padding

前面在`Container`中，可以通过它的`padding`属性来设置内边距，实际上有一个单独的组件就叫做`Padding`，专门用于设置边距。

```dart
Padding({super.key, required this.padding, super.child})
```

注意这里的`Padding`组件虽然是设置内边距，但是相对于它的子组件而言它就是设置外边距的，具体看怎么理解。例如下面给`Text`设置边距。

```dart
Column(
  children: [
    Padding(
      padding: EdgeInsets.all(10),
      child: Text("Hello3")
    ),
  ],
),
```

对于`Column`而言，实际上是设置了一个10的内边距，而对于`Text`而言，则是设置了一个10的外边距，所以加外边距还是加内边距，需要加到合适的位置。因此，只需要一个`Padding`组件即可，而不需要`Margin`组件。

#### Divider/VerticalDivider

对于一些需要边距的，我们可以通过`Padding`来设置，但是用`Padding`的话必须将子布局包起来，这对于一些边框需要比较多的场景就太麻烦了。例如在一个`Row`中，有三个子组件，现在想要子组件之间加上20的间隔。

```dart
Row(
  spacing: 20,
  children: [
    Text("Hello1"),
    Text("Hello2"),
    Text("Hello3"),
  ],
)
```

可以通过`spacing`属性完成，如果不用这个属性的话，需要用`Padding`将三个`Text`包裹起来，然后设置对应的左右边距，无疑非常麻烦。而通过`VerticalDivider`既可轻松实现。

```dart
Row(
  children: [
    Text("Hello1"),
    VerticalDivider(width: 20, color: Colors.transparent),
    Text("Hello2"),
    VerticalDivider(width: 20, color: Colors.transparent),
    Text("Hello3"),
  ],
)
```

`Divider`是水平方向的分割线，而`VerticalDivider`则是垂直方向上的分割线。下面看下构造方法：

```dart
 Divider({
    super.key,
    this.height,// 水平方向上的分割线，所以是高度
    this.thickness,
    this.indent,
    this.endIndent,
    this.color,
    this.radius,
})
```

接下来看下它的参数，首先就是和`height`，表示的是`Divider`的高度。`thickness`则是分割线的粗细，如果我们的`Divider`的高度比`thickness`大的话，分割线会居中显示在`Divider`的中间。

然后就是`indent`和`endIndent`，表示的是分割线的起始位置和终止位置的间隔，例如在`Divider`中，就表示的是分割线的最左边和最右边会留出一部分的空白，即分割线不会延伸到最边缘上。

`color`设置分割线的颜色，而`radius`设置分割线的圆角。

#### Card

#### Card

相比于`Container`而言，`Card`更关注于卡片布局，即圆角和阴影。如果使用`Container`的话，则需要通过`BoxDecoration`来设置阴影，而使用`Card`则可以更加关注这些。

```dart
Card({
    super.key,
    this.color,
    this.shadowColor,
    this.elevation,
    this.shape,
    this.margin,
    this.child,
})
```

`color`设置的是卡片的背景色，`shadowColor`设置阴影色，通常情况下我们不需要去设置阴影颜色，保持默认的就行。`elevation`视觉高度，设置这个高度后，可以使得卡片布局的阴影更大，就好像就卡片拉高了一样。

`shape`形状，类型为`ShapeBorder`，可以设置不同的形状。通过`shape`属性，可以设置卡片布局的边框和圆角等。例如可以设置为`CircleBorder`将卡片布局变成一个圆形的布局，也可以通过`RoundedRectangleBorder`设置为一个圆角的布局。

```dart
Card(
  // 卡片背景
  color: Color(0xFF00FFFF),
  // 卡片高度
  elevation: 24,
  shape: RoundedRectangleBorder(
    // 卡片边框
    side: BorderSide(
      color: Colors.black26,
      width: 10,
      style: BorderStyle.solid,
    ),
    // 卡片圆角
    borderRadius: BorderRadius.all(Radius.circular(30)),
  ),

  child: Padding(
    padding: EdgeInsets.all(10),
    child: Text("Hello3"),
  ),
),
```

用法比较简单，没有什么需要注意的，主要突出的就是一个卡片效果和阴影效果

#### Stack

类似于安卓中的`FrameLayout`，将所有的子布局直接重叠放置，后面的子布局会放置在前面的子布局的上面，从而可能会遮挡住前面的子布局。

```dart
const Stack({
    super.key,
    this.alignment = AlignmentDirectional.topStart,
    this.textDirection,
    this.fit = StackFit.loose,
    this.clipBehavior = Clip.hardEdge,
    super.children,
});
```

#### Center/Align

放置子组件的位置，`Center`将子组件放置在内部的居中位置，`Align`默认也是放置在中间位置，但是允许设置成别的位置。

```dart
Align({
    super.key,
    this.alignment = Alignment.center,
    this.widthFactor,
    this.heightFactor,
    super.child,
})
```

默认情况下，`alignment`取值为`center`，会将子组件放置在居中位置。其中`widthFactor`和`heightFactor`表示宽高的缩放比， 例如`widthFactor`为2的时候，`Align`组件的宽度会是子组件的宽度的2倍。

```dart
class Center extends Align {
  const Center({super.key, super.widthFactor, super.heightFactor, super.child});
}
```

`Center`是继承自`Align`的，只是去除了`alignment`参数，即不允许设置对其方法，只使用默认的居中对齐。

#### ListView

```dart
ListView({
    super.key,
    super.scrollDirection,
    super.controller,
    super.padding,
    List<Widget> children = const <Widget>[],
})
```

`ListView`也是非常常用的组件，用于构建列表，其中属性也比较多。重要的有`scrollDirection`滚动方向，可以设置为横向或者纵向。`controller`用来控制列表的滚动，可以获取到滚动的位置和偏移量，也可以主动控制列表滚动到某个位置等。然后就是`padding`，可以增加边距，当然不设置的话也可以用`Padding`组将将其包裹一下来实现相同的效果。最后就是`children`属性，列表的每一项，当`item`个数超过组件高度后，列表可以进行滚动。

当然实际上并不会直接通过`ListView`的这种方式去创建列表，因为一般情况下列表的条目都不是固定的，基本上都是根据请求的数据来进行动态构建，这就需要用到`ListView.builder`来动态创建。参数基本上是一样的，只是多了一个必选参数，`itemBuilder`参数，这个参数是一个函数类型参数，用于构建每一个`item`。

```dart
ListView.builder(
  itemCount: 100,
  itemBuilder: (_, index) => Padding(
    padding: EdgeInsets.all(10),
    child: Text("hello $index"),
  ),
),
```

需要提供两个参数，一个是`itemCount`表示需要生成多少个条目，一个是`itemBuilder`用来实际进行构建条目。

#### PageView

`PageView`是多界面的组件，类似于安卓中的`ViewPager`，用的地方也是挺多的。例如`banner`布局通常会用到这个组件，首页也会用这个组件做多个`tab`的分界面。

```dart
PageView({
    super.key,
    this.scrollDirection = Axis.horizontal,
    this.controller,
    this.physics,
    this.pageSnapping = true,
    this.onPageChanged,
    List<Widget> children = const <Widget>[],
})
```

属性比较多，首先是`scrollDirection`滚动方向，默认是横向滚动的，可以设置为纵向滚动，可以做成类似于抖音的视频滑动那样。

`controller`控制器，控制组件的页面切换，可以通过控制器切换到下一页、上一页或者指定页等。

`physics`物理引擎，控制组件的滑动情况，可以设置为正常滑动、回弹滑动、不允许滑动等。

`pageSnapping`是否自动归位，当滑动距离小于一半的时候，界面会自动划回来，超过一半的时候会自动划到下一页，默认为`true`。

`onPageChanged`界面切换时的回调，`children`子布局的集合。

### 总结

实际上`Flutter`中的默认`Widget`远不止这些，但是用法大同小异，通过参数名基本上就能猜个差不多，而且方法的注释也是非常多的，直接点击进入源码查看相应的方法注释也可以理解这些组件。

