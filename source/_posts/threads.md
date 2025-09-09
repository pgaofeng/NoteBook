---
title: Java多线程之间的加锁方式
date: 2024-03-09 17:57:03
categories: Java
tags:
 - Java
banner_img: img/cover/cover-threads.webp
---

`Java`多线程在实际开发中是应用非常广泛的，主要场景就是在需要多个任务需要同时执行的时候，并且线程中的数据是可以共享的，这也为多线程之间的协作奠定了基础。

在多线程场景中，最容易出问题的就是数据问题。由于数据是共享的，当多个线程对数据同时进行读写时，非常容易出现脏数据。因此引出了线程锁的概念，通过线程锁，可以将某块代码区域加锁，使其只允许一个线程访问，其他线程必须进行等待，从而避免多线程之间的问题。

### synchronized 

`synchronized`关键字就是线程锁的一种，通过它可以将代码块进行锁住，通常我们在写单例代码时会用到它。它可以声明在方法体上，表示整个方法体都被锁住，也可以用在代码块上以实现更精细的控制。

```java
public class Demo {
	// 当一个线程访问test方法时，其他线程无法访问test方法
    private synchronized void testMethod() {}
    
    public void testBlock() {

        // 当一个线程访问到这里时，其他线程可以进入test1方法，但是会阻塞在这里
        synchronized (Demo.class) {
            ...
        }
    }
}
```

`synchronized`关键字的两中用法，一种是直接在方法上使用，声明在返回值之前即可。另一种用法是直接通过`synchronized`关键字声明一个代码块，通过这个代码块进行加锁。注意，通过代码块的方式需要加入参数，这个参数就是锁的对象，即通过该参数来控制锁的生效范围。

例如上面的例子中，`synchronized (Demo.class)`参数是`Demo.class`，因此这个同步代码块就是在`Demo.class`上加的锁。

```java
private void main() {
    Demo demo1 = new Demo();
    Demo demo2 = new Demo();
    // 线程1在访问demo1的testBlock方法
    new Thread(()->{
        demo1.testBlock();
    }).start();
    // 线程2在访问demo2的testBlock方法，但是会被阻塞
    new Thread(()->{
        demo2.testBlock();
    }).start();      
}
```

如上示例，虽然线程访问的是两个对象各自的方法，但是线程2还是会阻塞在同步代码块前，等待线程1执行完才能进入代码块。这是因为代码块的锁是`Demo.class`，而`Demo.class`在虚拟机中是唯一的，因此线程1获取到锁之后，线程2只能进入阻塞等待线程1结束。

如果修改一下：

```java
public class Demo {
	private Objecet object = new Object();
    
    public void testBlock() {

        // 将锁换成object
        synchronized (object) {
            ...
        }
    }
}


private void main() {
    Demo demo1 = new Demo();
    Demo demo2 = new Demo();
    // 线程1在访问demo1的testBlock方法
    new Thread(()->{
        demo1.testBlock();
    }).start();
    // 线程2在访问demo2的testBlock方法，不会被阻塞
    new Thread(()->{
        demo2.testBlock();
    }).start();      
}
```

 锁被换成了`Demo`的一个内部创建的对象，这样当`demo1`执行到同步代码块时，获取到的是`demo1`的内部`object`锁，因此`demo2`仍可以访问它自己的代码块。而同步方法，就是相当于用同步代码块将整个方法包起来，然后锁对象换成自己`this`而已。

简单来说，避免多线程问题的方法就是将多线程变成单线程，即通过`synchronized`关键字将关键的部分通过锁来只允许单线程执行，从而解决问题。

### Lock

`Lock`接口也提供了一系列的加锁解锁的方法，用于解决多线程之间的并发问题。他比`synchronized`更加灵活，功能更加丰富，同时也是轻量级锁。

```java
public interface Lock {
    // 加锁，获取不到锁时阻塞
    void lock();
    // 加锁，如果获取锁时线程被中断，会抛出异常
    void lockInterruptibly() throws InterruptedException;
    // 尝试加锁，返回值表示是否加锁成功
    boolean tryLock();
    // 尝试加锁，无法获取锁时会等待time时间
    boolean tryLock(long time, TimeUnit unit) throws InterruptedException;
    // 解锁
    void unlock();
}
```

可以看到它提供的方法大部分都是涉及加锁的场景，`synchronized`当获取不到锁时线程会被阻塞，而通过`Lock`，可以通过`tryLock`等方法来判断是否能够获取到锁。它最常用的一个实例就是可重入锁`ReentrantLock`。

```java
public class Demo {

    private ReentrantLock lock = new ReentrantLock(/*true*/);

    public void doSomething() {
        lock.lock();
        ...
        lock.unlock();
    }
}
```

使用方式比较简单，直接实例化一个`ReentrantLock`即可，注意在构造方法中可以添加一个布尔参数来控制这个锁是否是公平锁（按照等待的顺序排队，先等待的线程先获取锁），默认是不公平锁（谁抢到锁谁先执行）。从名字也能看到这个锁是可重入锁，即当前线程获取锁后，还能继续获取锁，应用场景就是从一个加锁方法调用另一个加锁方法，或者加锁方法的递归场景。

而不论`synchronized`和`ReentrantLock`，对于加锁的粒度都还是有点粗，因此又引入了更加细化的读写锁。对于数据而言，通常情况下是允许多个线程同时读取的，但是不允许多个线程同时写入，因此可以通过读写锁来将这两种场景进行区分。

```java
public class Demo {

    // 构建读写锁
    private ReadWriteLock lock = new ReentrantReadWriteLock(/*true*/);
    // 通过读写锁分别获取读锁和写锁
    private Lock readLock = lock.readLock();
    private Lock writeLock = lock.writeLock();

    public void writeSomething(String str) {
        writeLock.lock();
        // 写入数据
        writeLock.unlock();
    }

    public String getSomething() {
        String str;
        readLock.lock();
        // 读取数据
        readLock.unlock();
        return str;
    }

}
```

通过读写锁，将读取操作和写入操作进行区分。当读取数据时，若是有线程已经获取了写锁，则会阻塞等待写锁释放才能继续获取读锁；若是没有线程获取写锁，则可直接获取到读锁，不论此时是否有其他线程已经获取了读锁。当写入数据时，必须保证没有线程获取读锁和写锁，否则会进入阻塞等待。

### 总结

在`Java`中，通常都是通过`synchronized`和`Lock`这两种方式来实现线程之间的同步。在早期的JDK中，`synchronized`的实现是通过底层的信号量方式，这种方式涉及到内核态和用户态的转换，通常被称为重量级锁，而`Lock`的方式只需要在用户态完成，被称为轻量级锁。

`synchronized`：非公平锁、可重入锁。

`ReentrantLock`：既支持公平也支持非公平锁、可重入锁

`ReentrantReadWriteLock`：既支持公平也支持非公平锁、可重入锁
