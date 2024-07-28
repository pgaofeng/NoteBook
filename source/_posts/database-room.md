---
title: 将Room的使用方式塞到脑子里
date: 2021-08-05 22:00:55
categories: Third Libraries
tags: 
  - Jetpack
banner_img: img/cover/cover-room.webp
---

## Room简介

`Room`是一个数据库框架，但它不是自己去实现的数据库，而是操作`sqlite`数据库，所以也可以称它为数据库封装框架。

对于使用者而言，仅需几个注解几个文件就能实现对数据库的操作，还是很方便的。并且由于采用的是编译时处理注解生成文件的方式，所以基本上不会有什么性能的损失。并且`Room`与协程也是无缝连接的，使用起来极其方便。



## 依赖添加

`Room`需要使用注解处理器，在`kotlin`项目中需要加上`kotlin-kapt`插件。

```groovy
plugins {
    ...
    id 'kotlin-kapt'
}

dependencies {
	...
    // room数据库
    def room_version = "2.3.0"
    implementation("androidx.room:room-runtime:$room_version")
    kapt("androidx.room:room-compiler:$room_version")
    
    // 若是想要使用kotlin相关的一些功能，如suspend，flow等需要使用room-ktx依赖
    // 若是加上了这个依赖，则前面的room-runtime依赖可以省略不加
    implementation("androidx.room:room-ktx:$room_version")
}
```



## 定义表结构

在`Room`中，我们不需要手动去创建表，而是定义一个实体类并且使用`@Entity`注解。这样`Room`就会根据类的字段去创建相应的数据库表，注意每个表必须都有一个主键。

```kotlin
@Entity
data class Person(
    @PrimaryKey
    val id:Int,
    val name:String
)
```

如上的一个`Person`类，就会在数据库中生成一个`Person`表，两个字段分别叫`id`和`name`，并且都是非空类型。也就是说，默认情况下，表的名字和对应的类名是一致的，列的名称也是与字段的名称是一致的。

并且，由于`Kotlin`有非空检查，所以创建的表的字段也会对应的是否可空。如上面的对象生成的`Person`表，其中`name`列就是`not null` 的。若是使用`Java`声明的类，则`name`默认就会是可空的，除非给`name`字段加上`NotNull`注解。而`id`因为是主键，所以一定是不为空的。



### 表属性

表的属性如表名，主键，外键等也是可以定制的，而不是一直固定死的。



#### 表名称

默认情况下，表名与类名保持一致。如上面的`Person`类对应的表名也是`Person`。可以通过`@Entity`的`tableName`属性进行修改。如下面的代码，则`Person`对应的表名就是`my_person`

```kotlin
@Entity(tableName = "my_person")
date class Person(...)
```



#### 列名

默认情况下，列名与字段名也是保持一致的。如上面的`name`字段对应的列名就是`name`。可以通过`@ColumnInfo`的`name`属性进行修改（`ColumnInfo`有很多属性，这里先只说`name`属性）。如下例，则是将列名改成`person_name`。

```kotlin
@Entity
data class Person(
    @PrimaryKey
    val id:Int
    @ColumnInfo(name = "person_name")
    val name:String,
)
```



#### 忽略的属性

在实体类中，有些字段可能是不想要映射在数据库的表中的，此时可以使用`@Ignore`注解某个不需要的字段，这样实体类对应的数据库表中就不会有该字段对应的列了。如下，则`Person`表中是没有`sex`列的。

```kotlin
// 方式一，使用@Ignore注解
@Entity
data class Person (
    ...
    @Ignore
    val sex: String
)

// 方式二，使用Entity的ignoreColumns属性
@Entity(ignoredColumns = ["sex"])
data class Person (
    ...
    val sex: String
)
```

**注意上面的代码是错误的，只是用来演示的**。在实体类中，要求每个字段都是能够访问的，并且要有不包含`@Ignore`的字段。如上例，构造方法中有了`sex`参数，所以会编译报错。并且，每个对应数据库列的字段都必须有`getter/setter`方法，其中`getter`是必须有的，而`setter`可以没有，但是没有`setter`的参数必须出现在构造方法中，也就是必须得提供一个注入的入口。

所以遇到`@Ignore`的参数，可以这样声明：

```kotlin
// 方式一，不放在构造方法中
@Entity
data class Person (
    @PrimaryKey
    val id: Int,
    val name: String
) {
    @Ignore
    val sex: String = "男"
}

// 方式二，额外提供一个不含sex的构造方法
// 提供的构造方法参数名字必须对应字段名字
@Entity
data class Person (
    @PrimaryKey
    val id: Int,
    val name: String,
    @Ignore
    val sex: String
){
    constructor(id: Int, name: String): this(id, name, sex = "男")
}

// 方式三，提供默认值让编译器自动生成构造方法
@Entity
data class Person @JvmOverloads constructor(
    @PrimaryKey
    val id: Int,
    val name: String,
    @Ignore
    val sex: String = "男"
)
```

从上面三种方式中，还是第一种方式比较好，首先比较简单，其次将二者分开了会显得更清晰。另外上面说的都是`data class`，而普通的类也是可以的： 

```kotlin
@Entity
class Person {
    @PrimaryKey
    var id: Int = 0
    @ColumnInfo(name = "m_name")
    var name: String = ""

    @Ignore
    val sex: String = "男"
}
```

注意上面的普通类没有提供构造方法，也就是默认的构造方法，这时候`id`和`name`必须设置为`var`类型，因为这样才会自动生成`getter/setter`方法。



#### 主键

每个表必须有一个主键，主键是唯一的，不能重复。一个表中的主键可以不只是一个字段，而可以由多个字段组成复合主键。有两种方式可以设置主键，一种是使用`@PrimaryKey`，一种是使用`@Entity`的`primaryKeys`属性设置。

```kotlin
// 方式一，使用@PrimaryKey直接设置在对应的字段上
@Entity
data class Person(
    @PrimaryKey
    val id:Int,
    val name:String
)

// 方式二，使用primarykeys属性
@Entity(primaryKeys = ["id"])
data class Person(
    val id:Int,
    val name:String
)
```

这两种的设置都能把`id`列设为主键，但是看起来还是第一种方式比较方便看着也清晰，所以一般使用第一种方式，直接将`@PrimaryKey`注解在对应的字段上即可。

但是第一种方式只能设置简单主键，也就是只有一个列是主键的情况。对于复合主键，则必须通过第二种方式去设置了。

主键还可以是自增的，将`autoGenerate`属性设为`true`即可，此时id可以设置也可以不设置，不设置则自动递增。但是这种情况下主键必须是`Int`或者`Long`类型，这样`insert`的时候，若是不带入主键，则自动递增设置值，注意这种情况下，主键要设置为可空的，然后在插入的时候赋值为`null`。递增是从1开始的，每次插入的时候会从最高的值开始递增。例如有两条数据，id分别是1和100，则下次插入数据的id则是101。

```kotlin
@Entity
data class Person (
    @PrimaryKey(autoGenerate = true)
    val id: Int?,
    val name: String,
)

// dao.insert(Person(null, "Person_1"))
```



#### 索引和唯一列

索引是数据库表中的一列或者多个列构成的一个排序的结构，当查询的时候，可以通过索引查询出位置，然后得到结果而不需要遍历原来的表数据来匹配结果。所以使用索引可以加快查询的速度。

可以将索引当成一个数据库表，存储着对应的数据以及相应位置的引用。但是这个表是给数据库管理系统使用的，不是给我们使用的，用户就正常执行相应的`SQL`语句，然后由数据库去进行优化选择是否查询索引。

创建索引需要消耗一定的存储空间，并且会拖慢更新表的操作，因为当插入或者修改表的时候也会更新索引表，但是好处是查询的速度大大增加（数据量很大的时候）。

而我们在手机本地存的数据显然不会很多，所以基本用不到索引。在`Room`中可以通过两种方式去创建索引。

```kotlin
// 方式一，通过ColumnInfo的index属性设置索引
@Entity
data class Person(
    ...
    @ColumnInfo(index = true)
    val childId:Int
)

// 方式二，使用Entity的indices设置索引
@Entity(indices = [Index("childId")])
data class Person(
    ...
    val childId:Int
)
```

方式一比较方便，直接在对应的字段上注解`ColumnInfo`并且设置`index`属性为`true`即可。但是这种方式只能设置单列的索引。若是多个注解，则会生成多个索引，而非多列的索引。

方式二比较强大，是通过`Entity`的`indices`属性去创建索引。`indices`是一个数组，可以设置多个索引，索引通过`Index`去配置。

```kotlin
// 创建两个索引，一个是只有name列的索引，一个是name和childId的双列的索引
@Entity(
    indices = [
        Index("name"),
        Index("name", "childId")
    ]
)
data class User(
    @PrimaryKey
    val uid: Int,
    val name: String,
    val childId: Int
)
```

上述的代码创建了两个索引，一个是`name`的索引，一个数`name`和`childId`的索引，像这种需要多个列的索引，用`ColumnInfo`是无法完成的。

索引还可以设置为`unique`，也就是索引不能重复。若是单列的索引，则该列的数据不能重复，若是多列的索引，则组合不能重复。 可以让某个列像是主键一样。

```kotlin
// 给name列创建一个索引，并且不能重复
@Entity(
    indices = [Index("name",unique = true)]
)
data class User(
    @PrimaryKey
    val uid: Int,
    val name: String,
    val childId: Int
)

// 插入一条数据
insert into User values(1, "张三", 1)
// 报错，因为name重复了，即使主键没重复
insert into User values(2， "张三"，2)
```



#### 默认值

列中字段是可以设置默认值的，当`insert`的时候，若是没有插入该列，则会自动使用默认值去填充。

```kotlin
@Entity
data class User(
    @PrimaryKey
    val uid: Int,
    @ColumnInfo(defaultValue = "nobody")
    val name: String,
    @ColumnInfo(defaultValue = "-1")
    val childId: Int
)
```

实际上，通过`Room`的`Dao`进行正常插入的时候，是无法使用到默认值的。因为`kotlin`是有非空检测的，因此不允许在`name`和`childId`字段传值为`null`。而若是将这两个字段设置为可空的话，对应的表的列属性也是可为`NULL`的，这时候传入`null`的话，表中的对应列也会是`NULL`，而不会去应用默认值。

所以，想要使用默认值，要么使用`Java`语言操作（定义实体类时使用`@NotNull`注解字段，然后传入`null`），要么使用`@Query`直接执行插入的`SQL`语句。涉及到的`DAO`部分会在后面讲解。

```kotlin
@Query("insert into User(uid) values(:id)")
suspend fun insertByQuery(id: Int)
```



#### 外键

外键只能通过`Entity`的`foreignKeys`属性去设置，类型为`ForeignKey`。

```kotlin
@Entity(
    foreignKeys = [
        ForeignKey(
            entity = User::class,
            parentColumns = ["uid"],
            childColumns = ["childId"]
        )
    ]
)
data class Person(
    @PrimaryKey
    val id: Int,
    val name: String,
    val childId: Int
)

@Entity
data class User(
    @PrimaryKey
    val uid: Int,
    val name: String
)
```

在上面的代码中，`Person`表中的`childId`是一个外键，引用`User`表中的`uid`列。这些都是在`ForeignKey`中配置的。首先参数`entity`指向外键引用的表对应的实体类，`parentColumns`指的是引用的表中的列，而`clildColumns`指的是本表中引用的列名。

其中`parentColumns`和`childColumns`都是数组类型的，二者的数量必须是对应的。并且对于外键引用的列，一般引用另一个表的主键，并且最好设置为索引`index`。若是引用的不是主键，则必须将引用列设置为索引并且`unique`。

##### 外键约束

具有外键的表操作具有级联属性，也就是当被引用的表修改时，引用的表也会同步修改。可以通过`ForeignKey`中的`onDelete`和`onUpdate`属性来设置约束操作。

```kotlin
@Entity(
    foreignKeys = [
        ForeignKey(
            entity = User::class, 
            parentColumns = ["uid"], 
            childColumns = ["user"],
            onDelete = ForeignKey.CASCADE,
            onUpdate = ForeignKey.CASCADE
        )
    ]
)
data class Person(
    @PrimaryKey
    val id: Int?,
    val name: String,
    val user: Int
)

@Entity
data class User(
    @PrimaryKey
    val uid: Int,
    val sex: String
)
```

如上例，`Person`表中的`user`列是一个外键，引用了`User`表中的`uid`列，并且设置了`onDelete`的操作为级联`CASCADE`。所以当`User`表发生删除事件后，也会对`Person`表中引用的数据进行删除。

```tex
User表中有一条数据：

   id  |  name
   ----+---------
    1  |   “男”


Person表中有两条数据：

   id  |  name   | user
   ----+---------+------
    1  |  “张三”  |  1
    2  |  “李四”  |  1
```

如上，`Person`表中两条数据的外键都是引用的`User`中的那条数据，所以当`User`表中的数据删除后，`Person`表中的两条引用数据也会自动删除，这就是`CASCADE`的效果。一共五种约束操作：

- `NO_ACTION` 没有操作，也就是默认约束，当删除`User`中那条数据的时候，由于被`Person`中的数据引用着，所以直接抛出异常
- `RESTRICT` 和`NO_ACTION`一样，不同是`RETRICT`在字段修改或删除的时候就去检查外键约束，而不是等语句执行完
- `SET_NULL` 将外键引用的表的字段设为`NULL`。如上表，当删除`User`中的数据时，`Person`表中的两条数据的`user`列的值都会被设置为`NULL`。当然，上面我们定义实体类的时候属性`user:Int`是非空的，所以实际删除的时候会抛出异常，要实现这种操作，必须将对应的外键的类型设置为可空的`user:Int?`。
- `SET_DEFAULT` 将外键的引用表的字段设置为默认值。需要注意的是，默认值必须也是存在于被引用的表中的字段，也就是`User`中的另一条数据。所以，这种情况下，被引用表`User`表至少要有一条数据,用于被`Person`表设置默认值，否则会因为找不到引用数据而抛出异常。
- `CASCADE` 级联操作，也是最常用的约束关系，当`User`表删除数据的时候，引用这条数据的`Person`表中的两条数据都会删除。修改`User`表的这条数据的`uid`的时候，`Person`表中的`user`字段也会改成新修改的值。



#### 表的数据类型

##### 基本数据类型

`Room`只支持八大基本数据类型和`String`类型。

- `Byte，Short，Int，Long`  表中被当做`INTEGER`存储
- `Boolean` 表中被当做`INTEGER`存储，0为`false`，1为`true`
- `Char` 表中被当做`INTEGER`存储，记录的值是其`ACSII`码
- `Float，Double` 表中被当做`REAL`类型存储
- `String` 表中被当做`TEXT`类型存储

##### 嵌套对象

也就是说，在定义表对应的实体对象的时候，字段默认是只能使用这九种数据类型的，若是使用了其他的类型，则在编译期间就会报错。

`Room`还提供了嵌套对象的注解`@Embedded`，可以将嵌套对象展开，作为当前表的字段。

```kotlin
@Entity
data class Person(
    @PrimaryKey
    val id: Int?,
    @Embedded
    val user: User
)

data class User(
    val uid: Int,
    val sex:String
)
```

如上面的代码，则生成的`Person`表中，一共有三列，分别是`id，uid，sex`可以看到直接将`User`类中的字段展开到了`Person`表中。这种展开是有限制的，就是名称不能重复，比如`Person`中有个字段叫做`id`，则`User`表中不能有`id`这个字段。

其中`User`这个类可以是普通的类，也可以是一个被`@Entity`的数据库表的实体类。

##### 类型转换

类型转换就是添加相应的`TypeConverter`，然后在操作数据库表的时候，`Room`就会根据`TypeConverter`将对应的字段转换成目标类型，然后在进行数据库操作。

```kotlin
object DateTypeConverter {

    @TypeConverter
    fun fromTimestamp(value: Long?): Date? {
        return value?.let { Date(it) }
    }

    @TypeConverter
    fun dateToTimestamp(date: Date?): Long? {
        return date?.time
    }
}
```

如上例，就是将`Date`类型和`Long`类型互相转换的转换器，使用`TypeConverter`注解来注解方法，表示该方法用来转换的。转换器可以是单例对象`object class` 也可以是普通的对像。当添加该转换器后，就可以定义具有`Date`字段的数据库映射对象了。

```kotlin
@Entity
data class Person(
    @PrimaryKey
    val id: Int?,
    val user: Date
)
```

注意，类型转换器只有一个参数，而且必须有返回值。参数和返回值构成了一组转换，并且对于一种类型，必须提供两个方法用于互相转换。至于怎么添加类型转换器，则放在后面再说。

###  表的关系

表的关系通常有三种，一对一，一对多，多对多。

#### 一对一

一对一是指两张表之间，一条数据只对应一条数据。这种关系比较简单，一般用于对表数据的拓展。两张表可以通过外键进行连接，外键不要单独使用一个列，这样容易行成多对多的关系。而是应该将一张表的主键设为另一张表的外键，从而构成一对一的关系。

```kotlin
// 一对一关系，一个人只有一个详细地址，一个详细地址对应一个人

@Entity
data class Person(
    @PrimaryKey
    val id: Int,
    val name: String,
    val sex: String
)

@Entity(
    foreignKeys = [ForeignKey(
        entity = Person::class,
        parentColumns = ["id"],
        childColumns = ["pid"],
        onUpdate = ForeignKey.CASCADE,
        onDelete = ForeignKey.CASCADE
    )]
)
data class PersonAddress(
    @PrimaryKey
    val pid: Int,
    val city: String,
    val address: String,
    val details: String
)
```

如上面就是设计了两张一对一关系的表，一个`Person`只能对应一个`PersonAddress`，同理一个`PersonAddress`也只能对应一个`Person`。二者通过外键链接，并且外键也被设置为了主键，同时设置为级联操作，当删除主表`Person`中的数据后，拓展表`PersonAddress`中对应的数据也会被删除。这是一个很标准的一对一关系的设计方式。

##### 查询方式

这种有关系的表的查询比较麻烦，需要额外定义一个类，用来存放查询结果。这个类不需要使用@Entity注解，因为它不对应数据库表，只是一个查询结果的容器。

```kotlin
data class PersonWithAddress(
    @Embedded
    val person: Person,
    @Relation(parentColumn = "id", entityColumn = "pid")
    val address: PersonAddress
)
```

其中，主要的字段使用`@Embedded`注解，其他字段使用`@Relation`来声明两个表之间的关系。其中`Relation`至少要写两个属性，`parentColumn`属性是`@Embedded`修饰类的字段，而	`entityColumn`属性则是当前类的字段。当查询到`Person`之后，会根据`Person.id`字段作为`PersonAddress.pid`字段去查询结果。所以会经历两个查询过程，因此还需要加上事务的注解`@Transaction`。

```kotlin
@Transaction
@Query("select * from Person where id = :id")
suspend fun queryPerson(id: Int): PersonWithAddress
```

若是想要查询以`PersonAddress`为主的话，则需要另外定义一个容器类：

```kotlin
data class AddressWithPerson(
    @Embedded
    val address:PersonAddress,
    @Relation(parentColumn = "pid", entityColumn = "id")
    val person:Person
)
// 对应的查询语句
@Transaction
@Query("select * from PersonAddress where pid = :id")
suspend fun queryAddress(id: Int): AddressWithPerson
```



#### 一对多

一对多关系也是用外键形成的，但是这种情况下，外键不能用主键了，而应该使用一个独立的列。

```kotlin
// 一对多关系，一个人有一个城市，但是一个城市可以有多个人

@Entity(
    foreignKeys = [ForeignKey(
        entity = City::class,
        parentColumns = ["cityCode"],
        childColumns = ["city"],
        onDelete = ForeignKey.CASCADE,
        onUpdate = ForeignKey.CASCADE
    )]
)
data class Person(
    @PrimaryKey
    val id: Int,
    val name: String,
    val city: Int
)

@Entity
data class City(
    @PrimaryKey
    val cityCode: Int,
    val cityName: String
)
```

同样的道理，这种多表之间的关系都是需要使用独立的类去进行存储的：

```kotlin
data class PersonWithCity(
    @Embedded
    val person: Person,
    @Relation(parentColumn = "city", entityColumn = "cityCode")
    val city: Int
)
// 对应的查询语句
@Transaction
@Query("select * from Person where id = :id")
suspend fun queryPerson(id: Int):PersonWithCity



data class CityWithPersons(
    @Embedded
    val city: City,
    @Relation(parentColumn = "cityCode", entityColumn = "city")
    val persons: List<Person>
)
// 对应的查询语句
@Transaction
@Query("select * from City where cityCode = :id")
suspend fun queryCity(id: Int):CityWithPersons

```

注意一点的是，`City`与`Person`是多对一的关系，因此`CityWithPersons`对象的`persons`属性需要写成`List`集合。

#### 多对多

对对多的关系需要使用第三个表来进行关联两个表。这里借用官网的例子，音乐表和播放列表表。关系是一首音乐可以存在多个播放列表中，一个播放列表中也可以有多首音乐。

首先定义两个表：

```kotlin
@Entity
data class Song(
    @PrimaryKey
    val songId:Int,
    val songName:String
)

@Entity
data class PlayList(
    @PrimaryKey
    val playId:Int,
    val playName:String
)
```

然后声明第三张表来定义关系，第三张表将前两张表的主键集合在一起，作为一张表，然后设置两个外键分别对应原来的两张表，同时也将这两列作为组合主键，避免数据重复。注意一点，第三张表的两个列名必须和引用的两个表的引用列名相同。：

```kotlin
@Entity(
    primaryKeys = ["songId", "playId"],
    foreignKeys = [
        ForeignKey(
            entity = Song::class,
            parentColumns = ["songId"],
            childColumns = ["songId"]
        ),
        ForeignKey(
            entity = PlayList::class,
            parentColumns = ["playId"],
            childColumns = ["playId"]
        )
    ]
)
data class SongPlayList(
    val songId: Int,
    val playId: Int
)
```

这样就完成了两个表的多对多关系的建立，每当有歌被添加到播放列表的时候，就可以向`SongPlayList`中添加一条数据即可。

对于查询还是一样要借助一个新的对象进行存储：

```kotlin
data class SongRecord(
    @Embedded
    val song: Song,
    @Relation(
        parentColumn = "songId",
        entityColumn = "playId",
        associateBy = Junction(SongPlayList::class)
    )
    val songPlayLists: List<PlayList>
)

// 对应的查询语句
@Transaction
@Query("select * from Song where songId = :id")
suspend fun querySong(id: Int): SongRecord
```

和前面基本上是一样的，唯一一点差别就是在`@Relation`的时候，额外加了一个属性`associateBy`，用来指示联系两张表的第三张表。



## 创建DAO

> `DAO`(Data Access Object) 数据访问对象是一个面向对象的数据库接口

说白了`DAO`就是一个接口，里面定义了多个方法，以对象的方式实现数据库表的增删改查功能。在`Room`中定义一个`Dao`异常简单，只需要声明一个接口，然后使用`@Dao`注解即可，具体的实现都会由`Room`来帮我们实现。

```kotlin
@Dao
interface UserDao {
	...
}
```



### Insert

> `Dao`中的增删改查都是耗时操作，是不允许在主线程调用的（可以在创建数据库对象的时候设置允许主线程调用，但是不推荐这样），在`kotlin`中可以设置为`suspend`方法，这样就可以避免手动去进行线程切换了。

`@Insert`用来注解一个方法，该方法用来实现对数据库表数据的插入。

```kotlin
@Dao
interface SongDao {
    @Insert()
    suspend fun insertSong(song: Song): Long

    @Insert
    suspend fun insertSongs(vararg songs: Song): List<Long>
    
    @Insert 
    suspend fun insertSongs(songs:Iterable<Song>): Array<Long>
}
```

在`Dao`中的方法上使用`@Insert`注解，可以声明该方法为插入方法，参数是要插入的数据。如上例，就是向数据库Song表中插入数据。参数可以是一个对象，也可以是多个。

`Insert`方法可以没有返回值，有返回值的话则只能是`Long`类型的。若是主键是单一主键并且类型是整型的话，则返回插入的主键。若是非整型主键或者是组合主键的话，则返回插入的行数，从**1**开始。

`@Insert`注解还有一个`onConflict`参数，用于定义当插入数据冲突（要插入的数据的主键在数据库表中已存在）时执行的操作。,一共有五种操作（两种已过时）:

- `OnConflictStrategy.ABORT` 终止插入，并且抛出异常
- `OnConflictStrategy.REPLACE` 覆盖原数据
- `OnConflictStrategy.IGNORE` 忽略这条数据，若是有返回值的话则返回`-1`



### Delete、Update

使用`@Delete`来注解一个方法为删除语句，参数仍然是映射对象。注意，删除只关注参数对象对应的主键，其他参数会忽略，只要主键匹配，就会删除。

删除方法也可以不加返回值，加的话只能使用`Int`返回值，代表本次删除的个数。

```kotlin
@Dao
interface SongDao {
    @Delete
    suspend fun delSong(song: Song): Int
    
    @Insert
    suspend fun delSongs(vararg songs: Song): Int
    
}
```

而将上述的`@Delete`改为`@Update`就成了一个更新语句，这时候会将主键对应的数据的全部列的值都更新成参数的值，并且返回值代表着更新的条数。



### Query

`Query`的难度较高一些，因为这需要我们自己去编写查询的`SQL`语句。`Query`注解的查询语句返回值可以是对象，也可以是`List`集合。注意如果是对象的话记得声明成可空的对象，因此有可能会查不到数据，而查询的是集合的话，则不用担心这点，因为查不到的话会返回一个空集合，而不会返回`null`。

```kotlin
@Dao
interface UserDao {
    @Query("select * from Song where songId = :songId")
    suspend fun querySong(songId: Int): Song?

    @Query("select * from Song")
    suspend fun querySongs(): List<Song>
    
    //返回值还可以使用LiveData或者Flow
    @Query("select * from Song")
    fun querySongsLive(): LiveData<List<Song>>
    
    @Query("select * from Song")
    fun querySongsFlow(): Flow<List<Song>>
}
```

`@Query`需要接收一个`SQL`语句，可以使用冒号加上方法的某个参数将其注入到`SQL`语句中，如上例的`:songId`。为了避免线程切换不仅仅可以定义为`suspend`方法，还可以修改返回值，使用`LiveData`或者`Flow`包裹返回值也行，这种情况下不能再使用`suspend`修饰了，只能是普通方法。并且，`LiveData`和`Flow`会持续的监听数据库的变化。比如上例查询所有的`Song`，当向数据库中插入一条新的`Song`的时候，返回值`LiveData`也会拿到新的一个`List`集合。

此外，`@Query`既然能执行`SQL`语句，那肯定就不只是有查询功能，插入删除修改都是可以的，当使用这些语句的时候，返回值跟前面使用注解的返回值要求是一样的。

```kotlin
@Dao
interface UserDao {
 @Query("insert into Song values(:id, :name)")
    suspend fun insertSong(id: Int, name: String)

    @Query("delete from Song where songId = :id")
    suspend fun delSong(id: Int)

    @Query("update Song set songName = :name where songId = :id")
    suspend fun update(id: Int, name: String)
}
```

使用`@Query`能够完全实现数据库表的增删改查，并且可以更加灵活。比如增加数据的时候只插入某几个列，其他列使用默认值（在`kotlin`中这是使用`@Insert`无法实现的）。比如修改数据的时候，只修改某几列，而不是全部修改（使用`@Update`会全部修改，即使某些列数据没发生改变）。



## 使用

当定义完表结构以及`Dao`后，就需要去创建数据库以及获取`Dao`实例了。数据库实例需要继承`RoomDatabase`，并且声明成抽象类，以及获取`Dao`的几个抽象方法。



### 定义数据库

```kotlin
@Database(
    version = 1,
    entities = [Song::class, SongPlayList::class, PlayList::class, User::class]
)
@TypeConverters(DateTypeConverter::class)
abstract class CustomDatabase : androidx.room.RoomDatabase() {
    abstract fun userDao(): UserDao
}
```

数据库对象需要使用`@Database`注解，并且声明参数`version`和`entities`。`version`代表的是数据库的版本号，每次数据库表有改动的时候，都需要增加版本号并且添加对应的`Migration`。`entities`是一个数组，内容是每个表所对应的实体类。

`@TypeConverter`是可选的，参数是一个`TypeConverter`数组，只有添加了类型转换器的时候才需要添加该注解。类型转换器在上面`定义表结构->表的数据类型->类型转换`一节有说过。

抽象类中还需要声明一些抽象方法，这些方法不需要参数，只要声明返回值为对应的`Dao`就行。



### 创建数据库以及对应的Dao

```kotlin
 val db = Room.databaseBuilder(this, CustomDatabase::class.java, "user.sqlite.db")
            .allowMainThreadQueries()
            .build()

val userDao = db.userDao()
```

使用`Builder`模式创建`Database`实例，然后在获取到`Dao`实例进行数据库的操作即可。其中创建数据库的`databaseBuilder`方法接收三个参数，第一个参数是`Context`，最好传入`ApplicationContext`；第二个参数是数据库对象的具体实现类；第三个参数是数据库文件的名字。

然后便可以通过多种方法去定义数据库的行为，如设置允许主线程操作，如设置`Transaction`的线程池，如从某个文件直接读取数据库(数据库文件已存在)等等。



### Migration

数据库一旦创建，就不能再修改表结构了，也就是说`@Entity`注解的对象的属性都是不能动的了，不管是删除修改还是添加一个属性，都是不允许的。

若是需要修改的话，则需要添加相应的`Migration`，然后操作数据库表，让其与修改后的`@Entity`实例对应。

```kotlin
// 一开始的User类，当前数据库版本为1
@Entity
data class User(
	@PrimaryKey
	val id: Int,
	val name: String
)
@Database(
    version = 1,
    entities = [User::class]
)
abstract class CustomDatabase : androidx.room.RoomDatabase() {
    ...
}

------------------------------------------------------------------------------

// 因为某些原因需要给User加一个字段sex
@Entity
data class User(
	@PrimaryKey
	val id: Int,
	val name: String,
	val sex: String
)
// 此时需要将@Database的version属性改为2或者其他大于1的数
@Database(
    version = 2,
    entities = [User::class]
)
abstract class CustomDatabase : androidx.room.RoomDatabase() {
    ...
}
// 然后创建对应Migration
val MIGRATION_1_2 = object :Migration(1, 2) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("alter table User add sex Text not null default '男' ")
    }
}
//在创建数据库的地方添加进去
db = Room.databaseBuilder(this, CustomDatabase::class.java, "user.sqlite.db")
            .allowMainThreadQueries()
            .addMigrations(MIGRATION_1_2)
            .build()
```

注意创建的`Migration`实例有两个参数，第一个是升级前的数据库版本，第二个参数是升级后的版本。可以在`migrate`方法中通过`database`执行`sql`语句去执行数据库的改变，这需要有一定的`SQL`语言基础。

如上例，添加了一个`sex`列，则在`migrate`中也使用`SQL`去添加了一个列来对应。注意若是新增的字段是非空的，则在`SQL`语句中也要声明为非空的，并且设置默认值（对应的字段上可以不用去声明默认值了）。

所以每次更改字段都必须升级数据库并且添加Migration，所以在开发阶段，每次修改字段后，直接卸载应用然后重新安装会更加方便。



## 总结

`Room`是一个数据库框架，使用它，可以让我们不用再将精力放在各种基本操作中，而是只专注于数据库表以及`Dao`。

并且`Room`的使用非常简单，仅需一些注解就能完成各种任务，与协程和`LiveData`和`Flow`紧密相连，使得使用更加方便。

`Room`使用的是编译时处理注解的技术，不会影响运行的效率。

