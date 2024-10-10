---
title: Android智能指针
date: 2023-01-14 20:21:42
categories: Android Framework
tags:
 - Binder
banner_img: img/cover/cover-sp-wp-refbase.webp
---

我们通常的代码都是使用`java`完成的，而`java`中有自己的内存回收机制，当对象不再使用时，会自动将内存回收，我们是不需要关注对象的回收的。而`C++`则不是这样，当我们`new`了一个对象后，当不需要再使用它的时候必须通过`delete`将内存回收。引用计数法是使用一个变量记录当前对象被引用的个数，当引用数为0时，表明该对象没有被引用了，即可以被回收了。但是引用计数法有个问题就是当存在互相引用的时候，会认为两个对象都存在引用关系，从而不会回收。但是Android智能指针通过另一种方式实现引用计数法，并没有直接通过对象本身进行引用，从而实现了内存的自动释放并且不会有相互依赖导致无法释放的问题。

```c++
int test() {
  A *a = new A;
  A a1;

  // 通过new创建的对象必须使用delete释放
  delete a;
  return 0;
}
```

`C++`有两种创建对象的方式，通过`new`创建的对象位于堆内存中，使用结束后必须通过`delete`回收。直接声明的则位于栈内存中，作用域结束后就自动回收了。因此可以将二者进行结合，实现堆内存中的对象也能直接回收。如示例，定义了`A`类，持有了`B`的引用，在`A`的析构函数中将`B`进行释放。

```c++
class B;

class A {
public:
  A(B* b) {
     mRef = b;
  }

  ~A() {
    delete mRef;
  }

private:
  B* mRef;
};
```

那么在实际使用中，就可以实现B对象的自动释放。

```c++
int test() {
  B *b = new B;
  A a(b);

  // 不需要delete b，作用域结束后a和b都会被释放
  return 0;
}

```

`Android`智能指针也是使用的上述的逻辑，通过栈内存的自动释放带动堆内存的自动释放，只是`Android`做的更加完善一些。它加入了引用计数，通过引用数来判断该对象是否需要被释放。因此，引用计数属性就需要定义在被应用的对象中，`RefBase`就是被抽取出来的基类，实现了引用计数的逻辑。 如果你的对象想要通过智能指针管理内存的释放，那么它必须继承自`efBase`，然后使用`sp`和`wp`进行引用。

### RefBase

`RefBase`是所有引用类的基类，也就是说想要通过智能指针管理内存释放的类，都必须继承`RefBase`。从下面的定义可以看到，`RefBase`内部的方法`incStrong/decStrong`就是主要用于引用计数的。其内部还定义了一个`weakref_type`的弱引用类型，对应的也有`incWeak`和`decWeak`。从这里我们可以看到`Android`的智能指针是有两种类型的，强引用和弱引用。

```c++
// system/core/include/utils/RefBase.h

class RefBase
{
public:
  // 引用计数+1
  void  incStrong(const void* id) const;
  void  incStrongRequireStrong(const void* id) const;
  // 引用计数-1
  void  decStrong(const void* id) const;
  void  forceIncStrong(const void* id) const;

  // 引入了弱引用类型
  class weakref_type
  {
  public:
     RefBase* refBase() const;
     // 引用计数+1
     void    incWeak(const void* id);
     void    incWeakRequireWeak(const void* id);
     // 引用计数-1
     void    decWeak(const void* id);
     bool    attemptIncStrong(const void* id);
     bool    attemptIncWeak(const void* id);
  };

protected:
  RefBase();
  virtual  ~RefBase();

private:
  friend class weakref_type;
  class weakref_impl;
  RefBase(const RefBase& o);

private:
  // 用来管理弱引用
  weakref_impl* const mRefs;
};

```



### sp

```c++

template<typename T>
class sp {
public:
  // 提供了很多的构造方法
  sp(T* other);
  sp(const sp<T>& other);
  ...
  // 重写了*和->操作符，方便直接操作实际的引用对象
  inline T&    operator* () const   { return *m_ptr; }
  inline T*    operator-> () const  { return m_ptr; }
  inline T*    get() const      { return m_ptr; }
  ...

private:
  T* m_ptr;
}

```

`sp`是智能指针的强引用使用方式，也就是通过`sp`来实现了内存的自动释放。对于我们使用而言，如我们需要一个`User`对象，那么我们`new User`之后，使用`sp<User>`包裹一下即可，后续也不需要关注什么时候需要释放`User`了。实际使用方式可以直接如下：

```c++
  User *mUser = new User;
  sp<User> p_user(mUser);

  // 可以直接使用->操作User的属性和方法
  p_user->setAge(10);
```

#### 实现流程

```c++
// system/core/libutils/RefBase.cpp

template<typename T>
sp<T>::sp(T* other)
     : m_ptr(other) { // m_ptr赋值为实际的对象

  if (other) {
     check_not_on_stack(other);
     // 增加强引用
     other->incStrong(this);
  }
}
```

当使用`sp`的时候，会在其构造方法中给`m_ptr`赋值为实际对象的引用，方便后续调用该引用的方法和属性等，同时增加了强引用的个数。这里的`other`是实际的引用对象，也就是`RefBase`的子类。

```c++
// system/core/libutils/RefBase.cpp

void RefBase::incStrong(const void* id) const
{
  // 获取到RefBase中的mRefs属性
  weakref_impl* const refs = mRefs;
  // 增加弱引用
  refs->incWeak(id);
  // 强引用个数+1
  const int32_t c = refs->mStrong.fetch_add(1, std::memory_order_relaxed);

  // 非第一次强引用，直接结束
  if (c != INITIAL_STRONG_VALUE) {
     return;
  }
  // 强引用个数减去初始值，现在变成实际的引用个数了
  int32_t old __unused = refs->mStrong.fetch_sub(INITIAL_STRONG_VALUE, memory_order_relaxed);
  refs->mBase->onFirstRef();
}
```

实际的操作都是在`weakref_impl`中完成的，它是定义在`RefBase`中的一个属性，主要作用就是用于记录引用个数的，在引用对象创建的时候同步创建`weakref_impl`。

```c++
//system/core/libutils/RefBase.cpp

RefBase::RefBase(): mRefs(new weakref_impl(this))
{
}
// 继承自weakref_type，主要作用就是用于存储引用数据
class RefBase::weakref_impl : public RefBase::weakref_type
{
public:
  std::atomic<int32_t>  mStrong; // 强引用个数
  std::atomic<int32_t>  mWeak; // 弱引用个数
  RefBase* const     mBase; // 实际的引用对象
  std::atomic<int32_t>  mFlags; // 当前的引用类型，标记当前是强引用还是弱引用

  explicit weakref_impl(RefBase* base)
     : mStrong(INITIAL_STRONG_VALUE) // 初始值INITIAL_STRONG_VALUE
     , mWeak(0) // 弱引用个数为0
     , mBase(base)
     , mFlags(OBJECT_LIFETIME_STRONG) // 当前属于强引用生命周期
  {
  }
}

// 弱引用数-1
void RefBase::weakref_type::incWeak(const void* id)
{
  weakref_impl* const impl = static_cast<weakref_impl*>(this);
  const int32_t c __unused = impl->mWeak.fetch_add(1,std::memory_order_relaxed);
}

```

在`sp`的构造方法中，将引用对象的强引用和弱引用的个数都增加了1，当该对象被很多个`sp`使用时，它的强引用和弱引用的个数都会有多个，因此在`sp`的析构函数中，应该会对引用个数进行判断，如果没有了引用个数，应该将该对象进行回收。

```c++
template<typename T>
sp<T>::~sp() {
  if (m_ptr)
      m_ptr->decStrong(this);
}

```

判断有误，在`sp`的析构函数中并没有判断引用个数，只是简单的减少了强引用的个数，因此，那些判断的逻辑应该是藏在了`RefBase`本身中。

```c++
void RefBase::decStrong(const void* id) const
{
  weakref_impl* const refs = mRefs;
  // 强引用个数-1
  const int32_t c = refs->mStrong.fetch_sub(1, std::memory_order_release);
  // 上一次是1，说明只存在一个强引用，因此当再次-1后强引用为0，需要回收内存
  if (c == 1) {
     std::atomic_thread_fence(std::memory_order_acquire);
     refs->mBase->onLastStrongRef(id);
     int32_t flags = refs->mFlags.load(std::memory_order_relaxed);
     if ((flags&OBJECT_LIFETIME_MASK) == OBJECT_LIFETIME_STRONG) {
       // 如果当前对象是强引用生命周期，则直接回收内存
       delete this;
     }
  }
  // 弱引用-1
  refs->decWeak(id);
}

void RefBase::weakref_type::decWeak(const void* id)
{
  weakref_impl* const impl = static_cast<weakref_impl*>(this);
  // 弱引用数-1
  const int32_t c = impl->mWeak.fetch_sub(1, std::memory_order_release);
  // 如果还存在弱引用，则直接返回
  if (c != 1) return;
  atomic_thread_fence(std::memory_order_acquire);

  int32_t flags = impl->mFlags.load(std::memory_order_relaxed);
  if ((flags&OBJECT_LIFETIME_MASK) == OBJECT_LIFETIME_STRONG) {
     if (impl->mStrong.load(std::memory_order_relaxed) == INITIAL_STRONG_VALUE) {
      ...
     } else {
       // 如果是强引用生命周期，当弱引用数为0时，回收weakref_impl的内存
       delete impl;
     }

  } else {
     // 如果是弱引用生命周期，当弱引用数为0时，回收引用对象的内存
     impl->mBase->onLastWeakRef(id);
     delete impl->mBase;
  }
}
```

#### 生命周期

在`sp`中，每次创建`sp`的时候，都会给引用对象的强引用数和弱引用数+1，然后在自动销毁`sp`的时候，在它的析构函数中将引用对象的强引用和弱引用数-1。因此，如果强引用数不为0，则弱引用数一定不为0。

在前面说过创建`RefBase`的时候，会同时创建一个`weakref_impl`对象，该`impl`用于存储强引用和弱引用的个数的。同时，`impl`还有一个属性`flag`，默认取值为`OBJECT_LIFETIME_STRONG`，即强引用生命周期，它还有一个取值为`OBJECT_LIFETIME_WEAK`弱引用声明周期。该值是用于控制引用类型什么情况下被回收的。

- `OBJECT_LIFETIME_STRONG`：如果强引用数为0，回收`RefBase`；如果此时弱引用数也为0，回收`weakref_impl`。

- `OBJECT_LIFETIME_WEAK`：如果弱引用数为0，回收`RefBase`，并且在`RefBase`的析构函数中回收`weakref_impl`。



通常情况下，不需要主动控制对象的生命周期类型，即默认的`OBJECT_LIFETIME_STRONG`就可以了，它会在没有强引用的时候销毁。但是，**如果你的对象比较重要**，你想要让它一直不销毁，直到所有的强引用和弱引用都不存在的时候才去销毁的话，可以在构造方法中调用`extendObjectLifetime(OBJECT_LIFETIME_WEAK)`将其切换成弱引用生命周期。

### wp
前面提到的`sp`是强引用，也是大部分场景下使用的引用，强引用的特点就是当前被引用的对象不会被回收掉，每次都可以直接拿来使用。弱引用与强引用的使用方式是一样的，直接使用`wp<>`引用原对象即可，它的特点是当前引用的对象可能已经被回收额，因此，如果想要通过弱引用访问对象的属性或方法时，必须先判断对象是否为空。

```c++
template <typename T>
class wp
{
public:
  // 提供多个构造方法
  static inline wp<T> fromExisting(T* other);
  wp(T* other);
  ...
  // 升级为强引用
  sp<T> promote() const;
  ...
  // 获取到引用对象
  inline T* unsafe_get() const { return m_ptr; }

private:
  // 实际的引用对象
  T*       m_ptr;
  weakref_type*  m_refs;
};
```
`wp`并没有重写`*`和`->`操作符，因此无法直接对引用对象进行操作，它提供了一个`unsafe_get`方法来获取到引用对象，从方法名可以看到这个方法是不安全的，就是这个方法返回的`T*`可能是已经被回收过了的。另外还提供了一个`promote`方法，用于将弱引用转换成强引用。

```c++
template<typename T>
wp<T>::wp(T* other)
  : m_ptr(other)
{
  m_refs = other ? m_refs = other->createWeak(this) : nullptr;
}
```
构造方法也没做什么，就是将引用赋值给`m_ptr`，然后调用了引用对象的`createWeak`，最终的结果也就是将弱引用值-1。
```c++
RefBase::weakref_type* RefBase::createWeak(const void* id) const
{
  mRefs->incWeak(id);
  return mRefs;
}
```
注意这里的区别：强引用`sp`的构造方法中，将强引用数和弱引用数都+1操作了，而弱引用`wp`的构造方法中只给弱引用数+1了，也就是说，实际的引用对象中：**弱引用数 >= 强引用数**。
```c++
template<typename T>
wp<T>::~wp()
{
  if (m_ptr) m_refs->decWeak(this);
}
```
析构函数中也没有别的操作，只是将弱引用数-1。具体逻辑前面已经讲过了，弱引用数-1后，判断是否还有弱引用，然后对应的判断是否需要回收对象。

#### promote
`wp`访问引用对象只有两种方式，一种是通过`unsafe_get`方法获取到引用对象本身，另一种方式就是通过`promote`方法将弱引用转换成强引用。

```c++
template<typename T>
sp<T> wp<T>::promote() const
{
  // 空构造方法创建sp
  sp<T> result;
  if (m_ptr && m_refs->attemptIncStrong(&result)) {
    // 设置引用对象给sp
    result.set_pointer(m_ptr);
  }
  return result;
}
```
这里就比较讲究了，调用的`sp`的空构造方法，也就是说实际上是没有引用对象的，也没有给强引用数+1。只有当引用对象还存在的时候，并且`attemptIncStrong`返回`true`的时候才会设置引用对象，此时才会升级成功。因此，通过`promote`升级为强指针后仍要判断是否为空。
```c++
bool RefBase::weakref_type::attemptIncStrong(const void* id)
{
  // 弱引用+1
  incWeak(id);

  weakref_impl* const impl = static_cast<weakref_impl*>(this);
  int32_t curCount = impl->mStrong.load(std::memory_order_relaxed);

  // 说明当前对象已经存在了强引用
  while (curCount > 0 && curCount != INITIAL_STRONG_VALUE) {
    // 给强引用数+1就行了
    if (impl->mStrong.compare_exchange_weak(curCount, curCount+1,
        std::memory_order_relaxed)) {
      break;
    }
  }

  // 强引用数为0，或者为初始值。说明要么该对象已被回收，要么创建后就没被强引用过
  if (curCount <= 0 || curCount == INITIAL_STRONG_VALUE) {
    
    int32_t flags = impl->mFlags.load(std::memory_order_relaxed);
    // 如果是强引用生命周期
    if ((flags&OBJECT_LIFETIME_MASK) == OBJECT_LIFETIME_STRONG) {
      // 强引用数为0，说明对象已经销毁了
      if (curCount <= 0) {
        // 弱引用-1，对应开头的弱引用+1。因为对象销毁了，所以升级失败了
        decWeak(id);
        return false;
      }
      
      // 给强引用值+1
      while (curCount > 0) {
        if (impl->mStrong.compare_exchange_weak(curCount, curCount+1,
            std::memory_order_relaxed)) {
          break;
        }
      }
      // 又判断了一次，其他线程刚好此时将对象销毁了
      if (curCount <= 0) {
        decWeak(id);
        return false;
      }
    } else {
      // 弱引用生命周期，由对象本身决定是否升级为强引用
      if (!impl->mBase->onIncStrongAttempted(FIRST_INC_STRONG, id)) {
        decWeak(id);
        return false;
      }
      // 强引用+1
      curCount = impl->mStrong.fetch_add(1, std::memory_order_relaxed);
      if (curCount != 0 && curCount != INITIAL_STRONG_VALUE) {
        impl->mBase->onLastStrongRef(id);
      }
    }
  }

  // 如果当前的引用对象之前从未被强引用过，需要将强引用数减去初始值，使其变成1
  if (curCount == INITIAL_STRONG_VALUE) {
    impl->mStrong.fetch_sub(INITIAL_STRONG_VALUE,
        std::memory_order_relaxed);
  }
  return true;
}
```
这里升级为强引用时判断了引用对象的生命周期类型，如果是强引用生命周期并且未被回收，则直接升级成功，强引用和弱引用数都+1处理。如果是弱引用生命周期类型，则交给对象本身去决定是否能够升级成功。
```c++
bool RefBase::onIncStrongAttempted(uint32_t flags, const void* /*id*/)
{
  return (flags&FIRST_INC_STRONG) ? true : false;
}
```
因为我们是弱引用生命周期才走到这个判断，所以这里一直返回`false`。也就是说，对于强引用生命周期的对象的`wp`弱引用来说，是有可能通过`promote`升级为强引用`sp`来使用的；但是对于弱引用生命周期的对象来说，是永远无法`promote`的（除非重写`onIncStrongAttempted`方法）。从上面的这些分析也可以看出来，`promote`的作用并不是将`wp`转成`sp`的，而是要将弱引用生命周期的对象转成强引用生命周期的。
总结下来就是：`promote`默认情况下是不会改变对象的生命周期类型的，只是会创建出一个新的`sp`来使用，并且这个新的`sp`还不一定有值。因此，**一般情况下可以不需要管这个方法**，直接使用`unsafe_get`即可。

### LightRefBase
轻量级`RefBase`，只支持`sp`强引用，不支持`wp`弱引用。比较简单，就是本身存储一个变量记录强引用的个数。如果只使用强引用的话，可以直接继承`LightRefBase`，否则继承`RefBase`。
### 使用方式
```c++
sp<User> p_user = new User;
int age = p_user->age;
// age = (*p_user).age;
// age = p_user.get().age

wp<User> w_user = new User;
if(w_user.unsafe_get() != nullptr) {
  int age1 = w_user.unsafe_get().age;
}
```
### 总结
引用数：使用`sp`强引用时，会给强引用数和弱引用数同时+1；使用`wp`弱引用时，只会给弱引用数+1。
生命周期：对象继承自`Refbase`从而支持强引用和弱引用，同时，对象本身也是区分为强生命周期和弱生命周期的。强生命周期在没有了强引用时会被销毁掉；弱引用生命周期会在没有了弱引用时销毁。因为一个对象的**弱引用数>=强引用数**，所以可以看出来弱引用生命周期的对象存在的时间会久一些。默认是强引用生命周期。
使用方式：强引用可以直接通过`*`、`->`、`get`方式来调用引用对象的属性和方法；弱引用可以通过`unsafe_get`来访问。
