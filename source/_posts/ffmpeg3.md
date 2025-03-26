---
title: FFmpeg解码音频PCM
date: 2023-11-13 15:04:49
categories: Third Libraries
tags:
 - FFmpeg
banner_img: img/cover/cover-ffmpeg3.webp
---

我们知道使用`FFmpeg`解封装就是从音频中不断地读取`AVPacket`，但读取的`packet`仍是压缩后的数据，如果我们想要播放，还必须要将其解压成原始的音视频数据才能播放，这个过程就是解码操作。同样，反过来将原始的音视频数据压缩成对应的格式的过程，称为编码过程。

### 解码音频

编解码相关的模块是`avcodec`模块， 因为音视频数据的压缩格式是不同的，因此当读取到音视频流之后，需要根据流的信息来选择不同的解码器进行解码。音频流解码出来的是`PCM`数据，视频流解码出来的基本上都是`YUV`数据，具体是什么数据取决于它的压缩方式。

解封装后我们拿到的是`AVPacket`，它代表着一段音频或视频数据，我们通过特定的解码器将其解码，解码后的结果就是`AVFrame`。注意的是，一个`AVPacket`解码出来后并不是对应一个`AVFrame`，尤其是对于视频流的解码。可能一个`AVPacket`解码出多个`AVFrame`，也可能一个`AVFrame`也解不出来。

#### 音频信息

音频流数据基本上都是`PCM`数据，它主要的参数就是采样率和采样精度以及通道数。音频本质上就是一个音波，我们将其模拟成数字信息存储在文件中，而从波到数字的转换就是在波上获取采样点，当采样点足够多的时候，这些采样点就可以组成一个波，从而模拟出声波。采样率就是每秒钟的采样个数，通常采样率为`44100Hz`，采样率越大，声音模拟的越真实，但同样文件大小也会变大。

然后就是采样精度，采样精度是用来记录波的高度的，如果将其对应到坐标系中，采样精度就是用什么类型的数字来表示`y`的大小，通常有`8bit`、`16bit`等，采样精度越高，对声音的模拟越真实，同样文件大小也会变大。

通道数也即是声道数，常用的是双声道的立体音。其中每个声道的数据都是独立的，假如有一个单通道的`PCM`数据的大小是`2M`，那么双通道的大小为`4M`，其实就是相当于两个`PCM`音频拼接成一个音频这样。**在`FFmpeg`中**多通道的音频在排列上分为平面模式`planar`和交错模式`Interleaved`，其中`planar`模式就是按顺序存放，先第一通道的数据，再第二通道数据，再第三通道数据，类似于简单的拼接，`AAABBBCCC`这样存储。而`Interleaved`模式则是交错模式，每个通道的数据交错在一块，如`ABCABCABC`这样，这也是实际中的`PCM`的存储方式。

#### 解码音频数据

解码后的被称为`AVFrame`，解码的数据在其`data`和`extend_data`数据中，它们都是一个二维数组，区别就是`data`是一个固定大小为8的数组，而`extend_data`的大小不固定。对于视频而言它们基本上是没有区别的，但是对于音频来说就有了区别。

对于`planar`模式的音频，它们会按顺序排列，即`data[0]`代表第一个通道数据，`data[1]`代表的是第二个通道的数据，如果通道数不超过8那没什么区别，如果超过8则只能使用`extend_data`了。

对于`Interleaved`模式的音频，它们会交错在一起，最终看起来就相当于只有一个通道，因此直接使用`data[0]`或者`extend_data[0]`来拿数据就行了。

```c
void read_audio(AVFrame *frame) {
    AVSampleFormat sampleFormat = (AVSampleFormat)frame->format;
    int dataLength = frame->nb_samples * av_get_bytes_per_sample(sampleFormat);
    fwrite(frame->data[0], sizeof(uint8_t), dataLength, pcmFile);    
}
```

如上示例，简单点就是计算音频数据的长度，然后将第一通道的音频数据写入到输出文件中，该文件就是`PCM`文件。注意这里的长度是计算出来的，通过采样个数(`nb_samples`)乘以每个采样点的大小得到的长度。其实也可以通过`frame->linesize[0]`来获取到长度，但是可能因为对齐等问题，导致该长度比实际的数据长度要长，因此这里直接通过计算获取长度。

`planar`模式是在`FFmpeg`中的模式，大部分的解码器解出来的都是`planar`模式，但是实际中的音频却都是`Interleaved`模式。如果我们只想保存某个通道的音频，那`planar`模式无疑非常简单，但要想所有通道都保存的话，则需要将解码出来的数据重新交错成`Interleaved`模式。

```c
void read_audio(AVFrame *frame) {
    AVSampleFormat sampleFormat = (AVSampleFormat)frame->format;
    int sampleLength =  av_get_bytes_per_sample(sampleFormat);
    // 交错写入，按顺序每个通道一个采样点一个采样点写入
    for(int sample = 0; sample < frame->nb_samples; sample++) {
        for(int channel = 0; channel < frame->ch_layout.nb_channels; channel++) {
            fwrite(
                frame->extended_data[channel] + sample * sampleLength, 
                sizeof(uint8_t),
                sampleLength,
                pcmFile
            );    
        }
    }
}
```

注意只有`planar`模式下才能交错写入，如果是`Interleaved`模式，直接写入`data[0]`即可。放在一起就是这样的：

```c
void read_audio(AVFrame *frame) {
    AVSampleFormat sampleFormat = (AVSampleFormat)frame->format;
    int sampleLength =  av_get_bytes_per_sample(sampleFormat);
    int sampleCount = frame->nb_samples;

    if(av_sample_fmt_is_planar(sampleFormat)) {
        // planar模式下需要交错写入各组通道音频数据
        for(int sample = 0; sample < frame->nb_samples; sample++) {
            for(int channel = 0; channel < frame->ch_layout.nb_channels; channel++) {
                fwrite(
                    frame->extended_data[channel] + sample * sampleLength, 
                    sizeof(uint8_t),
                    sampleLength,
                    pcmFile
                );    
            }
        }
    } else {
        // 非planar模式下，各组通道已经交错在一起，直接保存data[0]即可
        fwrite(frame->data[0], sizeof(uint8_t), sampleLength * sampleCount, pcmFile); 
    }
}
```

还有一点，解码出来的`PCM`裸数据是很大的，一个`10M`的`MP3`文件解出来的`PCM`数据大约`100M`，注意自己的存储空间。另外就是`PCM`裸流是无法直接播放的，因为不清楚视频的参数，如采样率、采样大小等信息，因此可以在运行时打印出这些信息，方便我们测试音频是否导出正常：

```c
    char sampleName[50];
    av_get_sample_fmt_string(sampleName, 50, audioCodecContext->sample_fmt);
    printf("sampleRame = %d, sampleFmt = %s, channel = %d\n",
            audioCodecContext->sample_rate,
            sampleName, 
            audioCodecContext->ch_layout.nb_channels
    );
```

输出内容如下：

```
sampleRame = 44100, sampleFmt = fltp     32 , channel = 2
```

因此，当运行结束后，我们可以根据这些参数来进行播放，我们可以将`PCM`导出到电脑上用`ffplay`播放，或者在线进行播放都行。

`ffplay`命令：`ffplay.exe -f f32le -ch_layout stereo -sample_rate 44100 -i audio.pcm`

主要注意`-f`参数，也就是我们打印的`sampleFmt`参数，该参数为`fltp 32`，也就是32位的浮点数，所以命令参数为`f32le`；然后是`-ch_layout`通道数，单通道输入`mono`，双通道输入`stereo`。

#### 完整代码

```c
// C++中使用必须extern
extern "C" {
    #include "libavformat/avformat.h"
    #include "libavcodec/avcodec.h"
    #include "libavutil/samplefmt.h"
}

AVFormatContext *inFormatCtx = nullptr;
AVPacket *packet = nullptr;
AVFrame *frame = nullptr;
const AVCodec *audioCodec = nullptr;
AVCodecContext *audioCodecContext = nullptr;
FILE *pcmFile;

void read_audio(AVFrame *frame) {
    AVSampleFormat sampleFormat = (AVSampleFormat)frame->format;
    int sampleLength =  av_get_bytes_per_sample(sampleFormat);
    int sampleCount = frame->nb_samples;

    if(av_sample_fmt_is_planar(sampleFormat)) {
        // planar模式下需要交错写入各组通道音频数据
        for(int sample = 0; sample < frame->nb_samples; sample++) {
            for(int channel = 0; channel < frame->ch_layout.nb_channels; channel++) {
                fwrite(
                    frame->extended_data[channel] + sample * sampleLength, 
                    sizeof(uint8_t),
                    sampleLength,
                    pcmFile
                );    
            }
        }
    } else {
        // 非planar模式下，各组通道已经交错在一起，直接保存data[0]即可
        fwrite(frame->data[0], sizeof(uint8_t), sampleLength * sampleCount, pcmFile); 
    }
}

void free() {
    if(inFormatCtx != nullptr) {
        avformat_close_input(&inFormatCtx);
        inFormatCtx = nullptr;
    }
    if(packet != nullptr) {
        av_packet_free(&packet);
        packet = nullptr;
    }
    if (frame != nullptr) {
        av_frame_free(&frame);
    }
    if(pcmFile != nullptr) {
        fclose(pcmFile);
        pcmFile = nullptr;
    }
}

int convert(char* inputFile, char* outputFile) {
    int ret;
    // 打开输入文件
    ret = avformat_open_input(&inFormatCtx, inputFile, nullptr, nullptr);
    if(ret) {
        printf("error in open stream");
        free();
        return -1;
    }
    // 打开输出文件
    pcmFile = fopen(outputFile, "wb");
    // 查找流
    ret = avformat_find_stream_info(inFormatCtx, nullptr);
    if(ret < 0) {
        printf("find stream error");
        free();
        return -1;
    }
    // 音频流的index
    int streamIndex = -1;
    for(int i = 0; i < inFormatCtx->nb_streams; i++) {
        AVStream *stream = inFormatCtx->streams[i];
        if(stream->codecpar->codec_type != AVMEDIA_TYPE_AUDIO) {
            continue;
        }
        // 查找到音频流之后，加载解码器，创建解码器上下文，打开加码器
        streamIndex = i;
        audioCodec = avcodec_find_decoder(stream->codecpar->codec_id);
        audioCodecContext = avcodec_alloc_context3(audioCodec);
        avcodec_parameters_to_context(audioCodecContext, stream->codecpar);
        avcodec_open2(audioCodecContext, audioCodec, nullptr);
    }
    if(audioCodec == nullptr || audioCodecContext == nullptr) {
        printf("cannot find audioCodec\n");
        free();
        return -1;
    }
    // 输出音频的基本信息，方便后续播放解码出来的pcm
    char sampleName[50];
    av_get_sample_fmt_string(sampleName, 50, audioCodecContext->sample_fmt);
    printf("sampleRame = %d, sampleFmt = %s, channel = %d\n",
        audioCodecContext->sample_rate,
            sampleName, 
            audioCodecContext->ch_layout.nb_channels
        );
    // 开始解码
    packet = av_packet_alloc();
    frame = av_frame_alloc();
    while (true) {
        // 读一个packet
        ret = av_read_frame(inFormatCtx, packet);
        if(ret) {
            printf("end of file\n");
            break;
        }
        // 只读音频流，清空packet
        if (packet->stream_index != streamIndex) {
            printf("other packet, ignore\n");
            av_packet_unref(packet);
            continue;
        }
        
        // 把packet发给解码器
        avcodec_send_packet(audioCodecContext, packet);
        // 从解码器读取解出来的帧
        while (true) {
            ret = avcodec_receive_frame(audioCodecContext, frame);
            if(ret < 0) {
                break;    
            }
            // 保存音频帧
            read_audio(frame);
            av_frame_unref(frame);
        }
    }
    // 读不到packet之后，还需要再次解码，避免丢掉最后几帧，参数传null
    avcodec_send_packet(audioCodecContext, nullptr);
    // 解码出frame
    while (true) {
        ret = avcodec_receive_frame(audioCodecContext, frame);
        if(ret < 0) {
            break;    
        } 
        read_audio(frame);
        av_frame_unref(frame);
    }
    printf("finish\n");
    free();
    return 0;
}
```

代码逻辑很清晰，还是一样的流程。先打开音视频文件，然后查找流，加载对应的解码器，读`packet`，将`packet`发给解码器，从解码器中读解码后的数据`frame`，将`frame`中的`pcm`写入本地。

然后就是在`jni`中使用：

```c++
extern "C" JNIEXPORT void JNICALL
Java_com_example_ffmpegdemo_MainActivity_convert(
        JNIEnv* env,
        jobject /* this */,
        jstring input,
        jstring output) {

    const char* in = env->GetStringUTFChars(input, nullptr);
    const char* out = env->GetStringUTFChars(output, nullptr);
    convert(in, out);
    env->ReleaseStringUTFChars(input, in);
    env->ReleaseStringUTFChars(output, out);
}
```

在`MainActivity`中使用：

```kotlin
binding.button.setOnClickListener {
    // 耗时操作，在子线程调用
    thread {
        // data/data/com.example.ffmpegdemo/files/cache/1.mkv
        val inputFile = File(cacheDir, "1.mkv")
        // 同目录下会生成2.pcm
        val outputFile = File(cacheDir, "2.pcm")
        convert(inputFile.absolutePath, outputFile.absolutePath)
    }
}
```

**注意这里的`input`文件，可以是视频文件，也可以是音频文件。**

### 总结

前面是解码音频的逻辑，主要就是在打开文件后查询流信息，然后这里我们只关注了音频的信息，即只创建了音频的解码器和解码器上下文，后面的逻辑就是不断的读`packet`然后发送给解码器，然后再从解码器中读取解码后的`frame`。如果我们在查询流信息后也创建了对应的视频解码器和解码器上下文，那么我们就可以将属于音频的`packet`发送给音频解码器，将属于视频的`packet`发送给视频解码器，最终各自处理解码后的`frame`即可。
