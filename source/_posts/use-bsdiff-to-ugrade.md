---
title: 在Android中使用Bsdiff实现增量更新
date: 2021-09-06 21:07:51
categories: Third Libraries
tags: 
  - 增量更新
  - bsdiff
banner_img: img/cover/cover-bsdiff.webp
---

在`Android`中，我们应用内更新软件通常是下载完整的安装包，然后进行安装。但是当安装包很大的时候，每次更新都会让用户不爽，因为不仅会消耗很多流量，而且当用户网络不是很好的时候，更新就会很慢，而且会影响到用户体验，比如下载期间占用带宽导致加载图片缓慢等。因此，用户很可能会拒绝更新。

`bsdiff`就是一种差量算法，可以根据两个文件间的区别生成一份差量文件，然后根据旧文件和差量文件重新生成新文件。应用在`Android`中是这样的：用户安装的是`v1.0`版本，然后当更新`v2.0`版本时，服务端根据`v1.0`和`v2.0`生成一个差量包`patch`，然后用户提示更新的时候去下载`patch`，再在本地根据已安装的版本`v1.0`和`patch`合成`v2.0`版本然后进行安装更新。

## 编译服务端使用的bsdiff

在服务端，是可以直接安装`bsdiff`的，但是为了保持`bsdiff`版本与应用中的版本的一致，因此采用自己编译的方式。

### 下载源码

首先下载`bsdiff`的源码：[官网地址](http://www.daemonology.net/bsdiff/) ，但是官网下载的时候居然提示403。因此我上传了一份到`github`上，可以从[github下载](https://github.com/pgaofeng/BsPatch/releases/tag/bsdiff4.3)或者从[这里下载](https://src.fedoraproject.org/lookaside/pkgs/bsdiff/bsdiff-4.3.tar.gz/e6d812394f0e0ecc8d5df255aa1db22a/)。

然后下载`bzip2`的源码：从[SourceForge下载](https://sourceforge.net/projects/bzip2/)，因为bsdiff需要使用到bzip2。

### 开始编译

`Windows`编译是很麻烦的，缺少相应的环境和工具，并且`bsdiff`中还引用了一些`Linux`中的头文件。所以这里选择在`Linux`中编译。

首先解压`bsdiff`和`bzip2`，并将二者置于同一个目录中。

```
.
├── bsdiff-4.3
│   ├── bsdiff.1
│   ├── bsdiff.c
│   ├── bspatch.1
│   ├── bspatch.c
│   └── Makefile
├── bzip2-1.0.6
...
```

然后修改`bsdiff`中的`Makefile`，因为`bsdiff`引用了`bzip2`的头文件和库文件，所以需要将搜索路径指向我们解压后的`bzip2-1.0.6`。同时，`Makefile`中还有一些格式问题，同样需要修改。修改后的Makefile如下：

```makefile
BZIP2PATH=../bzip2-1.0.6
CC=gcc

CFLAGS          +=      -O3 -lbz2 -L${BZIP2PATH} -I ${BZIP2PATH}
  
PREFIX          ?=      /usr/local
INSTALL_PROGRAM ?=      ${INSTALL} -c -s -m 555
INSTALL_MAN     ?=      ${INSTALL} -c -m 444

all:            bsdiff bspatch
bsdiff:         bsdiff.c
	$(CC) bsdiff.c $(CFLAGS) -o bsdiff
bspatch:        bspatch.c
	$(CC) bspatch.c $(CFLAGS) -o bspatch

install:
        ${INSTALL_PROGRAM} bsdiff bspatch ${PREFIX}/bin
        .ifndef WITHOUT_MAN
        ${INSTALL_MAN} bsdiff.1 bspatch.1 ${PREFIX}/man/man1
        .endif
```

改动不是很多，首先加了一个`BZIP2PATH`参数并指向`bzip2`的路径，然后在`CFLAGS`中指定库文件搜索目录`-L${BZIP2PATH}`和头文件搜索路径`-I ${BZIP2PATH}`为`bzip2`路径。其次是指定了编译器为`gcc`，并且给`bsdiff`和`bspatch`添加了明确的生成的命令。最后是在`install`命令中的`.ifndef`和`.endif`前加了个`tab`缩进。

 在`CFLAGS`中，使用`-lbz2`链接了`bz2`库，所以需要先生成`libbz2.a`。切到`bzip2-1.0.6`目录中，然后执行命令：

```makefile
# 因为只需要libbz2.a，所以其他的不需要编译
make libbz2.a
```

此时在`bzip2-1.0.6`中可以看到生成了`libbz2.a`文件，然后切回`bsdiff-4.3`目录中执行命令：

```
make
```

这时候，在`bsdiff-4.3`目录中就会生成`bsdiff`和`bspatch`两个可执行文件了。实际上我们是不需要`bspatch`这个可执行文件的，因为合成步骤是在手机上完成的，服务端只需要使用`bsdiff`去生成`patch`差分文件即可。

所以可以使用命令：`make bsdiff`仅生成`bsdiff`可执行文件。

### 生成差分文件

使用刚才编译出的`bsdiff`去生成差分文件，后接三个参数，第一个是旧版本的文件，第二个是新版本的文件，第三个是生成的差分文件：

```bash
./bsdiff app-v1.apk app-v2.apk patch
```

执行上述命令后就会生成`patch`文件，这个`patch`文件应该是小于`app-v2.apk`的。当更新时，用户只需要下载`patch`文件即可。以上就是整个服务端需要做的事了，就是编译`bsdiff`，然后生成差分文件。

## 在Android中使用bspatch合成安装包

`bspatch`是用于合成安装包的可执行文件。前面使用`bsdiff`将旧版本和新版本比较产生`patch`文件，这里的`bspatch`就是将旧版本和`patch`合并成新版本文件，与`bsdiff`是一个对应的过程，也是`Android`上主要使用的方法。

```makefile
# 参数顺序和bsdiff是一样的
./bspatch apk-v1.apk apk-v2.apk patch
```



### 引入源文件

在`Android`中使用也是比较简单的，首先新建一个`native`项目或者`nativelib`。然后在`src/main/cpp`目录下，创建一个目录`bzip2-1.0.6`。将对应的`bzip2`源文件放在这里。

注意，并不需要放入`bzip2`解压后的所有文件，而是生成`libbz2.a`相关的源文件即可。可以在`bzip2-1.0.6`解压后的目录中查看Makefile文件：

```makefile
OBJS= blocksort.o  \
      huffman.o    \
      crctable.o   \
      randtable.o  \
      compress.o   \
      decompress.o \
      bzlib.o

libbz2.a: $(OBJS)
        rm -f libbz2.a
        $(AR) cq libbz2.a $(OBJS)
        
blocksort.o: blocksort.c
        @cat words0
        $(CC) $(CFLAGS) -c blocksort.c
huffman.o: huffman.c
        $(CC) $(CFLAGS) -c huffman.c
crctable.o: crctable.c
        $(CC) $(CFLAGS) -c crctable.c
randtable.o: randtable.c
        $(CC) $(CFLAGS) -c randtable.c
compress.o: compress.c
        $(CC) $(CFLAGS) -c compress.c
decompress.o: decompress.c
        $(CC) $(CFLAGS) -c decompress.c
bzlib.o: bzlib.c
        $(CC) $(CFLAGS) -c bzlib.c
```

上面是从`Makefile`中截取的一部分，从中可以看出我们需要`blocksort.c、huffman.c、crctable.c、randtable.c、compress.c、decompress.c、bzlib.c`七个文件，同时还需要两个头文件`bzlib.h`和`bzlib_private.h`。也就是一共**9**个文件，放入上述新建的`zip2-1.0.6`目录中。然后将`bsdiff`解压后的`bspatch.c`放入`src/main/cpp`中。

现在的目录结构应该是这样的：

```
.
├── src
│   ├── main
│   	├── cpp
│   		├── bzip2-1.0.6
|			├── bspatch.c
│   		├── nativelib.cpp
│   		└── CMakeLists.txt
├
...
```

其中`nativelib.cpp`是新建`module`的时候自动生成的，可以修改成其他文件名，比如这里我就修改成了`bspatch_merge.cpp`。

### 编写CMakeLists.txt

然后编写`CMakeLists.txt`规则，将`bzip2`的源文件以及`bspatch`的源文件都添加进去：

```cmake
cmake_minimum_required(VERSION 3.10.2)
project("bspatch")

file(GLOB bzip_sources ${CMAKE_SOURCE_DIR}/bzip2-1.0.6/*.c)

add_library(
    bspatch
    SHARED

    bspatch.c
    bspatch_merge.cpp
    ${bzip_sources}
)


find_library(
    log-lib
    log
)


target_link_libraries(
    bspatch
    ${log-lib}
)
```

在`bspatch.c`中，入口方法也就是`main`函数，因为在`Linux`下最终是将`bspatch.c`编译成可执行文件的。而在`Android`中，我们最终是将它编译成一个共享库`so`，因此最好将`main`函数重命名一下，避免以后添加其他库的时候又有`main`函数导致冲突。这里将其改为`patch_main`。
并且，还需要将`bspatch.c`中引用的头文件`#include<bzlib.h>`改为`#include "bzip2-1.0.6/bzlib.h"`

### 编写代码

然后将`NativeLib`类重命名，改为`PatchUtils`，并定义成一个单例类：

```kotlin
object PatchUtils {

	init {
        // 这里的名字必须与CMakeLists.txt中的add_library中定义的一致
        System.loadLibrary("bspatch")
    }

    /**
     * 注意，该方法是一个耗时操作，不要放到主线程中去。
     *
     * 根据旧文件和差分包文件合并成新的文件
     * [newFile] 合并后的文件，应该是一个具体的文件路径
     * [oldFile] 旧文件的路径，应该是一个具体的文件路径
     * [patch]   差分包文件，应该是一个具体的文件路径
     *
     * 合并成功则返回true，否则返回false
     */
    external fun bsPatch(newFile: String, oldFile: String, patch: String): Boolean
}
```

此时`bsPatch`方法应该是报红色错误的，鼠标放在上面根据提示可以直接生成`jni`方法，选择生成文件位置的时候记得选择`bspatch.c`中。或者不让他生成，直接在`bspatch.c`中手写即可，这样的话需要注意方法中的包名和类名要保持一致。

```c++
#include <jni.h>
#include <string>

extern "C" {
extern int patch_main(int argc, char *argv[]);
}

extern "C"
JNIEXPORT jboolean JNICALL
Java_com_study_bspatch_PatchUtils_bsPatch(JNIEnv *env, jobject thiz, jstring new_file,
                                          jstring old_file, jstring patch_file) {
    const char *newFile = env->GetStringUTFChars(new_file, nullptr);
    const char *oldFile = env->GetStringUTFChars(old_file, nullptr);
    const char *patchFile = env->GetStringUTFChars(patch_file, nullptr);

    char *argv[] = {"", const_cast<char *>(oldFile), const_cast<char *>(newFile),
                    const_cast<char *>(patchFile)};
    int res = patch_main(4, argv);

    env->ReleaseStringUTFChars(old_file, oldFile);
    env->ReleaseStringUTFChars(new_file, newFile);
    env->ReleaseStringUTFChars(patch_file, patchFile);

    return res == 0;
}
```

首先通过`extern`关键字引入`bspatch.c`中的`patch_main`方法，然后调用。在可执行文件中，我们使用`./bspatch old.apk new.apk patch`命令去生成新文件，而对应的方法中，参数实际上是4个，因为第一个参数是函数本身，这里是需要注意的。

到这里就已经完成了`Android`中的引入了，使用的时候直接调用`PatchUtils.bsPatch`方法即可。当前安装的`apk`可以通过`context.applicationInfo.sourceDir`去获取。

详细代码上传至[github仓库](https://github.com/pgaofeng/BsPatch)上了。



## 总结

使用`bsdiff`进行安装包的增量更新并不难，甚至可以说是非常简单，因为我们实际上在`Android`中仅仅是去调用`bspatch`中的`main`方法去合成而已。同样的，Linux编译`bsdiff`也很简单，只是稍微修改一下`Makefile`就行了。

使用`bsdiff`可以有效的降低更新时下载的安装包的体积，因为只需要下载对应的`patch`分包即可，而不需要下载完整的安装包文件，这也是我们最终的目的。



但是，实际使用中却很麻烦，因为每次更新后，都需要和之前的所有旧版本`apk`生成对应的`patch`分包，然后在获取更新信息的时候，根据传递的版本参数返回对应的`patch`下载地址。

这只是一个渠道包的情况，实际上我们线上每个应用商店上传的包都是不同的渠道包，而各个应用商店大概有十来个。也就是说，每次升级，至少要产生十几个`patch`分包，并且这还只是和一个旧版本`apk`产生的，而实际中，我们又非常多的旧版本，这也就意味着，`patch`分包的文件数量将会非常多...

当然，可以编写脚本文件来管理....
