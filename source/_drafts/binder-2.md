---
title: Binder驱动
date: 2022-05-03 18:33:27
categories: Android Framework
tags:
 - binder
series: binder
banner_img: img/cover/cover-binder-2.webp
---


### 驱动

我们前面看的内容都是不包含真正和驱动交互的部分的，遇到跨进程的部分，基本上都是通过ioctl与驱动进行交互从而交换信息的，这里我们重新看下驱动部分。首先，binder驱动不属于aosp部分，而是属于kernal部分，它在另外的仓库中。然后就是binder驱动是一个字符驱动，我们与它的交互都是通过系统调用进入到内核中的。
它的文件目录在：common/drivers/android/binder.c

```c
const struct file_operations binder_fops = {
.owner = THIS_MODULE,
.poll = binder_poll,
.unlocked_ioctl = binder_ioctl,
.compat_ioctl = compat_ptr_ioctl,
.mmap = binder_mmap,
.open = binder_open,
.flush = binder_flush,
.release = binder_release,
};
```
在注册驱动的时候，会传入file_operations，这个结构体中将对应的方法映射到了驱动中的具体方法，这是由Linux内核完成的，我们不需要过多关注。例如我们在应用层中通过open打开驱动的时候，最终会经过一系列的调用然后走到驱动中定义的binder_open方法。这里面最重要的有三个方法：binder_open、binder_mmap、binder_ioctl，作用分别是打开驱动，建立映射关系，开始交互。

ProcessState初始化的时候就是与binder建立关联的一个流程，首先就是打开驱动：
```c
static int binder_open(struct inode *nodp, struct file *filp)
{
struct binder_proc *proc, *itr;

    // binder_proc存储了进程的信息
proc = kzalloc(sizeof(*proc), GFP_KERNEL);
INIT_LIST_HEAD(&proc->todo);
proc->pid = current->group_leader->pid;
INIT_LIST_HEAD(&proc->waiting_threads);
    // 每个进程调用到驱动中的filp都是不同的，因此后续可以从filp中取出当前进程的proc
filp->private_data = proc;

// 将proc加入到binder_procs链表中
hlist_add_head(&proc->proc_node, &binder_procs);

return 0;
}
```
主要作用就是创建进程对应的binder_proc，然后进行初始化并加入到全局链表中。然后就是查询驱动的版本，也就是走的ioctl的方法了，包括后面的设置最大线程数也是一样。
```c
static long binder_ioctl(struct file *filp, unsigned int cmd, unsigned long arg)
{
int ret;
    // 取出当前进程的proc
struct binder_proc *proc = filp->private_data;
    // 用户空间的参数的地址，也就是ioctl的最后一个参数
void __user *ubuf = (void __user *)arg;

switch (cmd) {
  case BINDER_SET_MAX_THREADS: {
u32 max_threads;
        // 从用户空间将数据拷贝到内核空间
if (copy_from_user(&max_threads, ubuf,
   sizeof(max_threads))) {
ret = -EINVAL;
goto err;
}
// 设置当前进程最大线程数
proc->max_threads = max_threads;
break;
  }
  case BINDER_VERSION: {
        // binder_version结构体中就只有一个参数protocol_version，因此
        // 可以直接引用,common/include/uapi/linux/android/binder.h
struct binder_version __user *ver = ubuf;
        // 将版本号写入到用户空间
if (put_user(BINDER_CURRENT_PROTOCOL_VERSION,
     &ver->protocol_version)) {
ret = -EINVAL;
goto err;
}
break;
  }
    }
return ret;
}
```
后续基本上所有的操作都是在binder_ioctl中完成的了，通过不同的命令，然后在不同的case块中完成具体的逻辑。这里的设置最大的线程数和查询驱动版本都是直接从内核空间与用户空间互相拷贝的，具体的业务命令时，涉及传输的文件就比较大了，直接拷贝会有性能问题，因此会通过mmap将内核空间和用户空间的地址进行映射，就不需要多次拷贝了。
```c
static int binder_mmap(struct file *filp, struct vm_area_struct *vma)
{
struct binder_proc *proc = filp->private_data;
    // vma是一段连续的虚拟内存空间，这里的大小是1M-2*page
vma->vm_ops = &binder_vm_ops;
vma->vm_private_data = proc;
return binder_alloc_mmap_handler(&proc->alloc, vma);
}

// 进行内存映射
int binder_alloc_mmap_handler(struct binder_alloc *alloc,
      struct vm_area_struct *vma)
{
struct binder_buffer *buffer;

// 设置映射的大小为vma的大小，即1M-2*page，并且限制最大不能超过4M
alloc->buffer_size = min_t(unsigned long, vma->vm_end - vma->vm_start,
   SZ_4M);
    // 标记为虚拟内存的起始位置
alloc->buffer = vma->vm_start;
    // 将映射的大小分为多个page，使用page管理内存
alloc->pages = kvcalloc(alloc->buffer_size / PAGE_SIZE,
sizeof(alloc->pages[0]),
GFP_KERNEL);
    // 创建binder_buffer结构体，来记录映射的那部分内存
buffer = kzalloc(sizeof(*buffer), GFP_KERNEL);
    // 将虚拟内存给到buffer
buffer->user_data = alloc->buffer;
    // 将其插入到alloc->buffers链表中
list_add(&buffer->entry, &alloc->buffers);
buffer->free = 1;
    // 插入到alloc->free_buffers红黑树中
binder_insert_free_buffer(alloc, buffer);
alloc->free_async_space = alloc->buffer_size / 2;
return 0;
}
```
事实上，当通过mmap进行内存映射时，并没有发生真正的映射，而是通过一系列的数据结构来存储这些内存信息。如首先在proc->alloc中记录了映射的内存的大小、指针，以及内存的分页信息等，然后就是创建了一个binder_buffer结构体，用于管理和记录映射的这部分内存，然后分别插入到alloc的biffers链表和free_buffers红黑树中。
所以最主要的就是binder_buffer结构体，它表示映射的一块内存，初始情况下所有的内存都分配给它自己并标记为free空闲状态。其中alloc->buffers链表存储所有的binder_buffer，而alloc->free_buffers只存储空闲的binder_buffer。

上述是通用的一部分逻辑，打开驱动，查询版本，设置最大线程数，建立内存映射。接下来我们看看ServiceManager的逻辑，首先是设置最大线程数为0，前面我们看过实现了，就是给proc的max_thread赋值而已。然后看看它是如何将自己注册成服务管理者的。
```c++
// frameworks/native/libs/binder/ProcessState.cpp

bool ProcessState::becomeContextManager()
{
    flat_binder_object obj {
        .flags = FLAT_BINDER_FLAG_TXN_SECURITY_CTX,
    };
    // 新方法传入了一个结构体，这个结构体只有flags属性
    int result = ioctl(mDriverFD, BINDER_SET_CONTEXT_MGR_EXT, &obj);

    if (result != 0) {
        // 新的方法不支持的话，使用旧的方法，只传了一个0
        int unused = 0;
        result = ioctl(mDriverFD, BINDER_SET_CONTEXT_MGR, &unused);
    }
    return result == 0;
}

// common/drivers/android/binder.c

case BINDER_SET_CONTEXT_MGR_EXT: {
struct flat_binder_object fbo;
        // 新方法中从用户空间中将结构体拷贝到内核空间
if (copy_from_user(&fbo, ubuf, sizeof(fbo))) {
ret = -EINVAL;
goto err;
}
ret = binder_ioctl_set_ctx_mgr(filp, &fbo);
break;
}
case BINDER_SET_CONTEXT_MGR:
ret = binder_ioctl_set_ctx_mgr(filp, NULL);
break;
```
最终是在binder_ioctl_set_ctx_mgr方法中处理的，新老方法的差异就是第二个参数是否为空：
```c
static int binder_ioctl_set_ctx_mgr(struct file *filp,
    struct flat_binder_object *fbo)
{
int ret = 0;
// 创建一个binder_node，表示一个binder
    // 同时会将其放到proc->nodes中
new_node = binder_new_node(proc, fbo);
context->binder_context_mgr_node = new_node;
return ret;
}
```
精简下来之后的流程也是比较简单，就是为ServiceManager创建一个内核的实体binder_mode，然后将其插入到proc->nodes中，并赋值为管理者即可。接下来是进入looper循环，looper之后就是一直等待epoll机制的唤醒了：
```c
case BC_ENTER_LOOPER:
    // 通常情况下，主线程BC_ENTER_LOOPER，子线程是BC_REGISTED_LOOPER
if (thread->looper & BINDER_LOOPER_STATE_REGISTERED) {
thread->looper |= BINDER_LOOPER_STATE_INVALID;
}
thread->looper |= BINDER_LOOPER_STATE_ENTERED;
break;
```
到这里已经告一段落了，接下来就是跨进程交互的事了。先总结下：ServiceManager启动的时候，会打开驱动建立内存映射，然后进入looper循环，到内核空间中就是创建进行对应的proc，然后通过proc->alloc管理内存，然后建立ServiceManager对应的binder_node，并设置为服务管理者，最后是标记线程为looper状态。
接下来就是ServiceManager的具体功能了，首先客户端进程通过handle为0的句柄创建BpServiceManager，然后调用addService方法注册自己的服务，这个过程实际上就是通过IPCThreadState向binder驱动写入内容。
```c++
  // 写入服务的标识符
  _aidl_ret_status = _aidl_data.writeInterfaceToken(getInterfaceDescriptor());
  // 注册的服务的名称
  _aidl_ret_status = _aidl_data.writeUtf8AsUtf16(name);
  // 注册的服务实体
  _aidl_ret_status = _aidl_data.writeStrongBinder(service);
```
这部分逻辑实际上是在AIDL生成的IServiceManager.cpp中实现的，也就是说它是将各种信息都写入到Parcel中，然后才通过IPCThreadState发送的。其他的不重要，主要看看service是如何被写入到Parcel中的。
```c++
status_t Parcel::writeStrongBinder(const sp<IBinder>& val)
{
    return flattenBinder(val);
}


status_t Parcel::flattenBinder(const sp<IBinder>& binder) {
    BBinder* local = nullptr;
    if (binder) local = binder->localBinder();

#ifdef BINDER_WITH_KERNEL_IPC
    flat_binder_object obj;
    if (binder != nullptr) {
        if (!local) {
            // binder是一个BpBinder，给obj赋值
            BpBinder *proxy = binder->remoteBinder();
            const int32_t handle = proxy ? proxy->getPrivateAccessor().binderHandle() : 0;
            obj.hdr.type = BINDER_TYPE_HANDLE;
            obj.binder = 0;
            obj.flags = 0;
            obj.handle = handle; // 唯一标识binder的handle
            obj.cookie = 0;
        } else {
            obj.hdr.type = BINDER_TYPE_BINDER;
            // 记录弱引用计数器的地址
            obj.binder = reinterpret_cast<uintptr_t>(local->getWeakRefs());
            // BBinder的地址
            obj.cookie = reinterpret_cast<uintptr_t>(local);
        }
    }

    // 写入obj
    status_t status = writeObject(obj, false);
    return finishFlattenBinder(binder);
#endif
}
```
service是被拆解成flat_binder_object的，而本地BBinde与是远程BpBinder是通过obj.hdr.type进行区分的，本地BBinder会通过cookie参数记录它的当前进程的地址，而远程BpBinder则是通过handle记录它的句柄值。然后就是往驱动中写入数据，前面我们已经看过了，最终Parcel会被包装在binder_write_read结构体中向驱动写入。
然后回到驱动中：
```c
case BINDER_WRITE_READ:
ret = binder_ioctl_write_read(filp, arg, thread);
if (ret)
goto err;
break;


static int binder_ioctl_write_read(struct file *filp, unsigned long arg,
struct binder_thread *thread)
{
int ret = 0;
struct binder_proc *proc = filp->private_data;
void __user *ubuf = (void __user *)arg;
struct binder_write_read bwr;

    // 将bwr从用户空间拷贝到内核空间
if (copy_from_user(&bwr, ubuf, sizeof(bwr))) {
ret = -EFAULT;
goto out;
}
    // 处理写入到驱动中的数据
if (bwr.write_size > 0) {
ret = binder_thread_write(proc, thread,
  bwr.write_buffer,
  bwr.write_size,
  &bwr.write_consumed);

}
if (bwr.read_size > 0) {
ret = binder_thread_read(proc, thread, bwr.read_buffer,
bwr.read_size,
&bwr.read_consumed,
filp->f_flags & O_NONBLOCK);
trace_binder_read_done(ret);
binder_inner_proc_lock(proc);
if (!binder_worklist_empty_ilocked(&proc->todo))
binder_wakeup_proc_ilocked(proc);
binder_inner_proc_unlock(proc);
if (ret < 0) {
if (copy_to_user(ubuf, &bwr, sizeof(bwr)))
ret = -EFAULT;
goto out;
}
}

if (copy_to_user(ubuf, &bwr, sizeof(bwr))) {
ret = -EFAULT;
goto out;
}
}

```