---
title: FFmpeg编译so库文件
date: 2023-09-06 19:21:34
categories: Third Libraries
tags:
 - FFmpeg
banner_img: img/cover/cover-ffmpeg1.webp
---

`FFmpeg`是一个音视频库，是使用`C语言`开发的，目前在各个行业都应用很广。在`Android`中，也通常都是使用其作为音视频播放和处理方案，当然为了更适配对应的平台，我们可能很少直接使用`FFmpeg`，而是使用其他的对`FFmpeg`进行二次封装的库，如`ijkPlayer`等，但了解`FFmpeg`会让我们在遇到难题时更易找到解决方案。

### FFmpeg的编译

如果要在`Android`中使用，我们通常会使用交叉编译的方式编出对应的so文件，然后在引入到`Android`中进行使用，这里最好使用在`Linux`环境中进行编译。

1. 创建一个编译目录：

```shell
mkdir buildffmpeg
cd buildffmpeg
```

2. 下载`ndk`：

```shell
# 下载ndk
sudo apt install curl
crul https://googledownloads.cn/android/repository/android-ndk-r27c-linux.zip --output android-ndk-r27c-linux.zip
# 解压
sudo apt install unzip
unzip android-ndk-r27c-linux.zip
```

此时在目录中会有一个`android-ndk-r27`的目录，这个目录就是`ndk`的目录。如果不想使用命令的方式，直接在浏览器中访问官网更好，因为可能下载到最新的`ndk`版本，地址是[https://developer.android.google.cn/ndk/downloads/index.html?hl=uk](https://developer.android.google.cn/ndk/downloads/index.html?hl=uk)

3. 下载`ffmpeg`源码：

```shell 
curl https://ffmpeg.org/releases/ffmpeg-7.1.1.tar.gz --output ffmpeg-7.1.1.tar.gz
tar -zxvf ffmpeg-7.1.1.tar.gz

# 或者直接通过git下载也行
# git clone https://git.ffmpeg.org/ffmpeg.git ffmpeg
```

此时目录中会有一个`ffmpeg-7.1.1`的目录，这个目录中存储的就是`ffmpeg`的源码。如果不想使用命令的方式，直接在浏览器中访问官网更好，因为可以下载到最新的版本或者你想要的版本。地址是：[https://ffmpeg.org/download.html#releases](https://ffmpeg.org/download.html#releases)

4. 编译链接库

在`FFmpeg`中有一个`configure`文件，该文件是一个脚本文件，用来控制如何进行编译的，如果是直接编译的话，直接执行`configure`文件即可，但我们需要在`Android`中使用，因此需要将`ndk`配置进去。

```shell
cd ffmpeg-7.1.1
touch build.sh
chmod u+x build.sh
```

我们进入到了`ffmpeg`目录，然后创建了一个`build.sh`文件，这个文件就是最终的编译脚本，我们会在其中调用`configure`文件从而达成编译的目的，文件内容如下：

```shell
#!/bin/bash
# NDK根目录
NDK=../android-ndk-r27c
# 编译文件的输出目录前缀，输出文件会放在这个目录下
PREFIX=output
# 工具链目录，方便后面引用的
TOOLCHAIN=$NDK/toolchains/llvm/prebuilt/linux-x86_64/bin
# 系统目录，会从该目录中找到对应的头文件和so文件进行编译
SYSROOT=$NDK/toolchains/llvm/prebuilt/linux-x86_64/sysroot
# 交叉编译的前缀，所有的命令都会加上这个前缀
CROSS_PREFIX=$TOOLCHAIN/llvm-
# Android版本，用于获取不同的cc命令
API=30

function build() {
    ./configure \
	    --prefix=$PREFIX/$ABI \
	    --cross-prefix=$CROSS_PREFIX \
	    --target-os=android \
	    --arch=$ARCH \
	    --sysroot=$SYSROOT \
	    --cc=${C_PREFIX}clang \
	    --cxx=${C_PREFIX}clang++ \
	    --pkg-config=pkg-config \
	    --disable-static \
	    --enable-shared \
	    --disable-ffmpeg \
	    --disable-ffplay \
	    --disable-ffprobe 

	make clean
	make -j16
	make install
}

echo "build armeabi-v7a..."
ARCH=arm
ABI=armeabi-v7a
C_PREFIX=$TOOLCHAIN/armv7a-linux-androideabi$API-
build

echo "build arm64-v8a"
ARCH=aarch64
ABI=arm64-v8a
C_PREFIX=$TOOLCHAIN/aarch64-linux-android$API-
build

echo "build x86_64"
ARCH=x86_64
ABI=x86_64
C_PREFIX=$TOOLCHAIN/x86_64-linux-android$API-
build
```

在然后就是进行构建了，这里编了三个不同架构的so库，一个是32位的`armv7a`，一个是64位的`arm64`的，还有一个模拟器的`x86_64`的，根据自己实际的项目进行选择，想要编译直接调用该脚本即可。

```shell
# 编译x86的so时需要安装nasm工具
sudo apt install nasm
# 构建
./build.sh
# 查看编译结果
cd output
ls
```

在`ffmpeg-7.1.1/output`目录下，是我们两次的编译结果，我们需要的就是对应的`include`中的头文件，以及`lib`中的`so`库文件。

### 参数说明

前面的编译脚本`build.sh`，实际看下就知道它最终还是通过`configure`脚本来实现的，只是通过不同的参数进行控制的。接下来先看下前面的参数：

```shell
./configure \
	--prefix=$PREFIX/$CPU \
	--cross-prefix=$CROSS_PREFIX \
	--target-os=android \
	--arch=$ARCH \
	--sysroot=$SYSROOT \
	--cc=${C_PREFIX}clang \
	--cxx=${C_PREFIX}clang++ \
	--pkg-config=pkg-config \
```

1. `--prefix`，它代表着输出产物的前缀，该目录可以随意设置，这里因为我们编译了两份产物，因此在前缀并不是相同的，避免文件重复。

2. `--cross-prefix`，它代表着交叉编译的前缀。编译的过程会涉及到很多的命令，如`nm`、`ar`等，正常编译会直接找到系统命令去进行编译，但我们编的不是当前平台，而是`android`平台，因此不能直接找系统中的这些命令，而是从`ndk`中查找。`android-ndk-r27c/toolchains/llvm/prebuilt/linux-x86_64/bin`这个目录中就是我们需要的命令，可以看到除了`clang`和`clang++`与平台版本有差异外，其他的都没有差异，而是都加了`llvm-`的前缀，因此这里的参数我们也需要设置成`llvm-`。

3. `--target-os`，目标平台直接填`android`就行。
4. `--arch` ，目标平台的架构，常见的`arm`是32位的架构，最通用的架构，老机型用的多；`aarch64`是64位的架构，目前的主流架构；`x86_64`模拟器上使用。
5. `sysroot`系统查找目录，包含了头文件以及对应的链接库文件，对应的是`android-ndk-r27c/toolchains/llvm/prebuilt/linux-x86_64/sysroot`目录
6. `--cc`和`--cxx`，编译c和c++的命令，对应着`llvm`中的`clang`和`clang++`。注意这里是有区分的，需要区分不同的架构和安卓版本号，如果我们不指定这两个参数的话，它会使用前面设置的`prefix`来查找命令，如它会去找`llvm-clang`命令，结果当然是找不到的。因此这里我们给他手动指定前缀，具体前缀可以在`android-ndk-r27c/toolchains/llvm/prebuilt/linux-x86_64/bin`目录中找到clang命令，然后查看规律在设置就行了，如`armv7a`，安卓30对应的是`armv7a-linux-androideabi30-clang`命令，`armv8a`安卓30对应的是`aarch64-linux-android30-clang`命令。
7. `--pkg-config`，这个是属于系统命令，需要确保系统中有安装`pkg-config`，可以通过`sudo apt install pkg-config`进行安装，为什么要明确指定呢，因为前面我们有设置`--cross-prefix`，该属性应用后会导致命令变成`llvm-pkg-config`，导致找不到对应的命令，因此我们才需要重新指定下。

前面的参数都是交叉编译所涉及的一些参数，不涉及到具体的功能相关，而后续的参数则是与`FFmpeg`相关的：

```shell
	--disable-static \
	--enable-shared \
	--disable-ffmpeg \
	--disable-ffplay \
	--disable-ffprobe \
```

1. `--disable-static`：关闭静态链接库，通常生成的是`.a`文件，在编译时会直接编在文件中
2. `--enable-shared`：打开共享库，通常生成的是`.so`文件，也是我们的目标文件
3. `ffmpeg`、`ffplay`、`ffrpobe`是`FFmpeg`的命令行工具，因为我们不需要它们，因此直接`disable`即可

更多的参数涉及到了封装、编码等相关功能，实际上基本所有的功能都是通过`disable`和`enable`命令来打开和关闭的，因此需要我们自己衡量并进行裁剪。因为`FFmpeg`的功能是非常多的，如果我们不做任何裁剪的话，生成的`so`也会很大，如果只是作为学习的话，就不用去裁剪了，完整版的才是最好的。具体的功能配置在`ffmpeg-7.1.1/configure`文件中都有说明。

### 引入到安卓中

如果先麻烦可以直接新建一个`native C++`项目，如果是已有项目则可以新建一个`Module`，然后将其配置成支持`C++`，如果不会配置的话，直接创建一个新的`native C++`项目，然后抄一下`gradle`的写法即可。

然后就是引入我们编译好的`so`文件，首先修改`gradle`：

```kotlin
android {
    ...
    defaultConfig {
        ...
        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64")
            // 如果是groovy的话，改成如下形式
            // abiFilters 'arm64-v8a', 'armeabi-v7a', 'x86_64'
        }
    }
}
```

主要就是修改`abiFilters`，因为我们只编译了这两种`so`。接着就是将`so`放在项目中，在该`module`的`src/main`目录下新建一个目录，注意如果`AGP`版本低于`4.0`的话，新建的目录名称需要是`jniLibs`，高于`4.0`就随意命名了，这里我命名的是`libs`目录。然后在该目录下新建两个目录分别为`arm64-v8a`和`armeabi-v7a`，然后将前面生成的`so`分别放在对应的目录中，大概的层级如下：

```
module
  |-src
    |-main
      |-libs
        |-arm64-v8a
          |--libavformat.so
          |--....
        |-armeabi-v7a
          |--libavformat.so
          |--....
        |-x86_64
          |--libavformat.so
          |--....
```

接下来修改项目中的`CMakeLists.txt`，将我们的so和头文件包含进去。首先是将`FFmpeg`的头文件放在`cpp`的目录中，这里为了区分新建了一个文件夹来放头文件，目录如下：

```
module
  |-src
    |-main
      |-libs
      |-cpp
        |-libraries
          |-ffmpeg
            |-include
          |-CMakeLists.txt
          |-native-lib.cpp
```

然后修改`CMakeLists.txt`，将头文件包含进来，然后在引入`so`文件：

```cmake
cmake_minimum_required(VERSION 3.22.1)
project("ffmpegdemo")

# 引入ffmpeg的头文件
include_directories("libraries/ffmpeg/include")

# 引入ffmpeg的库文件，根据实际引入，这里选择全引入
set(FFmpegs avcodec avdevice avfilter avformat avutil swresample swscale)
foreach (item IN LISTS FFmpegs)
    add_library(${item} SHARED IMPORTED)
    set_target_properties(
            ${item}
            PROPERTIES IMPORTED_LOCATION
            ${CMAKE_SOURCE_DIR}/../libs/${CMAKE_ANDROID_ARCH_ABI}/lib${item}.so
    )
endforeach ()

# 这是新建项目时自己创建的，暂时不用修改
add_library(${CMAKE_PROJECT_NAME} SHARED
        native-lib.cpp)

target_link_libraries(${CMAKE_PROJECT_NAME}
        ${FFmpegs} # 将ffmpeg的库都引入
        android
        log)
```

到这里就已经引入完成了，我们直接编译一个`apk`，然后将其拖入到`as`中，就能看到`apk`中已经包含了我们引入的`FFmpeg`的`so`。

我们可以直接修改`native-lib.cpp`中返回字串的函数，然后调用`FFmpeg`的方法查看我们编译`FFmpeg`时的配置信息：

```c++
#include <jni.h>
#include <string>

extern "C" {
#include "libavutil/avutil.h"
}


extern "C" JNIEXPORT jstring JNICALL
Java_com_example_ffmpegdemo_MainActivity_stringFromJNI(
        JNIEnv* env,
        jobject /* this */) {
	// 能成功调用，说明引入成功了
    const char* str  = avutil_configuration();
    return env->NewStringUTF(str);
}
```

直接运行就能看到输出的信息确实是我们编译时的`configure`信息。

