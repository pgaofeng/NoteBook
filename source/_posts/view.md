---
title: View的绘制流程
date: 2021-04-10 19:20:31
categories: Android View
tags:
 - View
banner_img: img/cover/cover-view.webp
---

`View`是我们在应用开发中用的最多的组件的，基本上所有的与界面相关的元素都是使用`View`呈现的。而`Android`为我们提供了很多的`View`供我们直接使用。如`LinearLayout`、`ImageView`等，当然我们也会根据自己的业务需求去自定义`View`，而在自定义的过程中，我们就会去在对应的绘制流程中做自定义操作。因此，了解`View`的绘制流程，对于我们自定义`View`来说是很有帮助的。

### View的绘制

界面布局分为`View`和`ViewGroup`，整个界面布局都是以`ViewGroup`为根节点的一个`View`树，这棵树的根节点也就是`DecorView`，最终被添加到`ViewRootImpl`中，这个过程是在`Activity#onResume`的时候添加进去的。所以，后续对于`View`树的管理，最终都是由`ViewRootImpl`直接触发的。

如`View`的绘制，直接的触发者就是`ViewRootImpl`，它会在需要刷新时，通过`preformTraversals`触发`View`的三个流程。这个方法非常长，大概有一千行，这里只关注对于`View`绘制的部分。

### Measure

`measure`是`View`绘制的第一个流程，它主要的作用就是触发自己以及子`View`的测量，目的是计算出自己所需要占据的空间的大小。

```java
// ViewRootImpl.java
private void performTraversals() {
    ...
    if (mFirst) {
        // 第一次需要进行布局
        mLayoutRequested = true;
        ...
    } else {
        desiredWindowWidth = frame.width();
        desiredWindowHeight = frame.height();
        // 如果宽高发生了变化，需要重新布局
        if (desiredWindowWidth != mWidth || desiredWindowHeight != mHeight) {
            ...
            mLayoutRequested = true;
            windowSizeMayChange = true;
        }
    }
    ...
    boolean layoutRequested = mLayoutRequested && (!mStopped || mReportNextDraw);
    if (layoutRequested) {
        ...
        windowSizeMayChange |= measureHierarchy(host, lp, mView.getContext().getResources(),
                    desiredWindowWidth, desiredWindowHeight, shouldOptimizeMeasure);
    }
    ...
}
```

当触发`preformTraversals`的时候，并不是一定会触发布局的流程，而是会判断宽高是否发生了变化，只有发生了变化，才会去触发布局流程，最终也是通过`measureHierarchy`触发的。

```java
// ViewRootImpl.java
private boolean measureHierarchy(final View host, final WindowManager.LayoutParams lp,
            final Resources res, final int desiredWindowWidth, final int desiredWindowHeight,
            boolean forRootSizeOnly) {
    int childWidthMeasureSpec;
    int childHeightMeasureSpec;
    boolean windowSizeMayChange = false;
    boolean goodMeasure = false;
    // 正常情况下lp.width的值为match_patent。这里通常对应的是dialog手动设置宽度为wrap_content
    if (lp.width == ViewGroup.LayoutParams.WRAP_CONTENT) {
        final DisplayMetrics packageMetrics = res.getDisplayMetrics();
        res.getValue(com.android.internal.R.dimen.config_prefDialogWidth, mTmpValue, true);
        int baseSize = 0;
        if (mTmpValue.type == TypedValue.TYPE_DIMENSION) {
            baseSize = (int)mTmpValue.getDimension(packageMetrics);
        }
        
        if (baseSize != 0 && desiredWindowWidth > baseSize) {
           // 以较小的baseSize获取测量属性spec
           childWidthMeasureSpec = getRootMeasureSpec(baseSize, lp.width, lp.privateFlags);
           childHeightMeasureSpec = getRootMeasureSpec(desiredWindowHeight, lp.height,
                lp.privateFlags);
           // 触发子View的绘制
           performMeasure(childWidthMeasureSpec, childHeightMeasureSpec);
           // 查看测量过后，root的测量结果是否太小
           if ((host.getMeasuredWidthAndState()&View.MEASURED_STATE_TOO_SMALL) == 0) {
               goodMeasure = true;
           } else {
               // 给大一点的宽度
               baseSize = (baseSize+desiredWindowWidth)/2;
               // 然后再次测量
               childWidthMeasureSpec = getRootMeasureSpec(baseSize, lp.width, lp.privateFlags);
               performMeasure(childWidthMeasureSpec, childHeightMeasureSpec);
               // 查看这次的测量结果是否还小
               if ((host.getMeasuredWidthAndState()&View.MEASURED_STATE_TOO_SMALL) == 0) {
                   goodMeasure = true;
               }
            }
        }
    }
    
    // 如果测量的结果不是一个好的结果，说明：
    // 1.宽度不是wrap_content，之前没测。2.宽度是war_content，但是给定的宽度不满足view的要求
    if (!goodMeasure) {
        // 以实际的窗口的宽度去获取测量属性spec
        childWidthMeasureSpec = getRootMeasureSpec(desiredWindowWidth, lp.width,
                lp.privateFlags);
        childHeightMeasureSpec = getRootMeasureSpec(desiredWindowHeight, lp.height,
                lp.privateFlags);
        if (!forRootSizeOnly || !setMeasuredRootSizeFromSpec(
                childWidthMeasureSpec, childHeightMeasureSpec)) {
            // 触发测量
            performMeasure(childWidthMeasureSpec, childHeightMeasureSpec);
        } else {
            // 如果只是测量root，并且宽高是match_parent或者具体值，则不会去measure了，省了一次测量
            mViewMeasureDeferred = true;
        }
        if (mWidth != host.getMeasuredWidth() || mHeight != host.getMeasuredHeight()) {
            windowSizeMayChange = true;
        }
    }
    return windowSizeMayChange;
}

private boolean setMeasuredRootSizeFromSpec(int widthMeasureSpec, int heightMeasureSpec) {
    final int widthMode = MeasureSpec.getMode(widthMeasureSpec);
    final int heightMode = MeasureSpec.getMode(heightMeasureSpec);
    // 宽高值是否是精确值，如果有一个不是的话，则返回false
    if (widthMode != MeasureSpec.EXACTLY || heightMode != MeasureSpec.EXACTLY) {
        return false;
    }
    // 宽高值都是精确值，即match_patent或者具体的数值
    mMeasuredWidth = MeasureSpec.getSize(widthMeasureSpec);
    mMeasuredHeight = MeasureSpec.getSize(heightMeasureSpec);
    return true;
}
```

在`measureHierarchy`中会进行一系列的判断，首先根据`WindowManager.LayoutParams`的宽高属性判断是否是`wrap_content`来决定如何测量，如果是的话，则不会给实际的宽度限制，而是给一个少一点的`baseSize`来让子`View`测量，如果测量过后结果为尺寸太小，则会重新给大一点的宽度再次测量，如果还太小，则会在后面重新按原尺寸进行测量。

如果`LayoutParams`的宽度不是`wrap_content`，或者在前面的的测量中，两次的测量结果都太小，则会使用具体的窗口宽高进行测量。

```java
// ViewRootImpl.java
private static int getRootMeasureSpec(int windowSize, int measurement, int privateFlags) {
    int measureSpec;
    // 如果设置了PRIVATE_FLAG_LAYOUT_SIZE_EXTENDED_BY_CUTOUT，则使用match_patent
    final int rootDimension = (privateFlags & PRIVATE_FLAG_LAYOUT_SIZE_EXTENDED_BY_CUTOUT) != 0
            ? MATCH_PARENT : measurement;
    switch (rootDimension) {
        case ViewGroup.LayoutParams.MATCH_PARENT:
            // 给定的宽度是窗口宽度，但是测量规格精确值
            measureSpec = MeasureSpec.makeMeasureSpec(windowSize, MeasureSpec.EXACTLY);
            break;
        case ViewGroup.LayoutParams.WRAP_CONTENT:
            /// 给定的宽度是窗口宽度，但是测量规格为最大值
            measureSpec = MeasureSpec.makeMeasureSpec(windowSize, MeasureSpec.AT_MOST);
            break;
       default:
            // 宽度是一个具体值，给定测量规格为精确值
            measureSpec = MeasureSpec.makeMeasureSpec(rootDimension, MeasureSpec.EXACTLY);
            break;
    }
    return measureSpec;
}
```

在通过`getRootMeasureSpec`获取到`root`的测量属性后，就会通过`performMeasure`进行测量。注意`View`的测量属性是一个`int`值，然后高2位表示测量模式，低30位表示具体的数值。最终的测量还是走到了`View`的`measure`方法。

```java
// ViewRootImpl.java
private void performMeasure(int childWidthMeasureSpec, int childHeightMeasureSpec) {
    if (mView == null) {
        return;
    }
    Trace.traceBegin(Trace.TRACE_TAG_VIEW, "measure");
    try {
        mView.measure(childWidthMeasureSpec, childHeightMeasureSpec);
    } finally {
        Trace.traceEnd(Trace.TRACE_TAG_VIEW);
    }
    mMeasuredWidth = mView.getMeasuredWidth();
    mMeasuredHeight = mView.getMeasuredHeight();
    mViewMeasureDeferred = false;
}
```

#### MeasureSpec

`MeasureSpec`是`View`的一个静态内部类，属于一个工具类，它的作用就是将模式和数值组合成一个测量属性，同样的也可以将一个测量属性拆分为模式和数值。它是用来限制子`View`的测量规格，其模式有三种：

- `EXACTLY`：精确模式，通常在xml中设置宽或高为`match_parent`或者具体数值
- `AT_MOST`：最大模式，通常在xml中设置为`wrap_content`是为最大模式
- `UNSPECIFIED`：未指定模式，使用这种模式表示对宽高没有要求，类似于`AT_MOST`但是不需要给定最大值限定

在了解了测量测试后，我们继续看后面子`View`的具体测量过程，即`measure`流程：

```java
// View.java
public final void measure(int widthMeasureSpec, int heightMeasureSpec) {
    
    // 根据宽高属性构建key，该key用于存储测量结果的缓存
    long key = (long) widthMeasureSpec << 32 | (long) heightMeasureSpec & 0xffffffffL;
    if (mMeasureCache == null) mMeasureCache = new LongSparseLongArray(2);
    // view是够设置了forceLayout
    final boolean forceLayout = (mPrivateFlags & PFLAG_FORCE_LAYOUT) == PFLAG_FORCE_LAYOUT;
    // 宽高属性是否发生了变化
    final boolean specChanged = widthMeasureSpec != mOldWidthMeasureSpec
           || heightMeasureSpec != mOldHeightMeasureSpec;
    // 宽高属性是否都是精确模式
    final boolean isSpecExactly = MeasureSpec.getMode(widthMeasureSpec) == MeasureSpec.EXACTLY
           && MeasureSpec.getMode(heightMeasureSpec) == MeasureSpec.EXACTLY;
    // 已测量的宽高是否与此次测量属性中的宽高一致
    final boolean matchesSpecSize = getMeasuredWidth() == MeasureSpec.getSize(widthMeasureSpec)
           && getMeasuredHeight() == MeasureSpec.getSize(heightMeasureSpec);
    // 是否需要测量
    final boolean needsLayout = specChanged
           && (sAlwaysRemeasureExactly || !isSpecExactly || !matchesSpecSize);

    // 如果需要测量，或者设置了forceLayout，则进行测量
    if (forceLayout || needsLayout) {
        // 清除测量属性
        mPrivateFlags &= ~PFLAG_MEASURED_DIMENSION_SET;
        resolveRtlPropertiesIfNeeded();
        // 如果不是forceLayout，则从缓存中取测量值
        int cacheIndex = forceLayout ? -1 : mMeasureCache.indexOfKey(key);
        if (cacheIndex < 0 || sIgnoreMeasureCache) {
            // 进行实际的测量
            onMeasure(widthMeasureSpec, heightMeasureSpec);
            mPrivateFlags3 &= ~PFLAG3_MEASURE_NEEDED_BEFORE_LAYOUT;
        } else {
            // 从缓存中获取，然后不需要测量，直接设置测量结果
            long value = mMeasureCache.valueAt(cacheIndex);
            setMeasuredDimensionRaw((int) (value >> 32), (int) value);
            mPrivateFlags3 |= PFLAG3_MEASURE_NEEDED_BEFORE_LAYOUT;
        }

         // 如果我们重写了onMeasure，必须要在测量完成后通过setMeasuredDimension设置测量结果，否则直接抛异常
        if ((mPrivateFlags & PFLAG_MEASURED_DIMENSION_SET) != PFLAG_MEASURED_DIMENSION_SET) {
            throw new IllegalStateException("View with id " + getId() + ": "
                    + getClass().getName() + "#onMeasure() did not set the"
                    + " measured dimension by calling"
                    + " setMeasuredDimension()");
        }

        mPrivateFlags |= PFLAG_LAYOUT_REQUIRED;
    }

    mOldWidthMeasureSpec = widthMeasureSpec;
    mOldHeightMeasureSpec = heightMeasureSpec;
    // 缓存测量结果，以便下次直接使用
    mMeasureCache.put(key, ((long) mMeasuredWidth) << 32 |
            (long) mMeasuredHeight & 0xffffffffL); // suppress sign extension
}
```

在`measure`中也还是没有进行实际的测量，它首先会判读是否需要测量：宽高发生了变化或者`forceLayout`。当满足条件后还不一定会测量，而是根据宽高属性构建key，然后从缓存中查看之前是否已经对这对宽高属性测量过，如果查到的话会直接设置为宽高属性，查不到的时候才会去`onMeasure`进行测量。当然如果`forceLayout`的话就会直接测量了，也不需要管宽高是否发生变化，是否有缓存等。

```java
// View.java
public void forceLayout() {
    if (mMeasureCache != null) mMeasureCache.clear();

    mPrivateFlags |= PFLAG_FORCE_LAYOUT;
    mPrivateFlags |= PFLAG_INVALIDATED;
}    
    
public void requestLayout() {
    ...
    mPrivateFlags |= PFLAG_FORCE_LAYOUT;
    mPrivateFlags |= PFLAG_INVALIDATED;
    ...
}
```

其中在`froceLayout`和`requestLayout`的时候，会设置`FORCE`属性，因此，如果我们想要强制进行测量时，就可以通过这两个方法中的任何一个来触发。然后接下来继续看`onMeasure`：

```java
// View.java
protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
    setMeasuredDimension(getDefaultSize(getSuggestedMinimumWidth(), widthMeasureSpec),
        getDefaultSize(getSuggestedMinimumHeight(), heightMeasureSpec));
}

public static int getDefaultSize(int size, int measureSpec) {
    int result = size;
    int specMode = MeasureSpec.getMode(measureSpec);
    int specSize = MeasureSpec.getSize(measureSpec);

    switch (specMode) {
    case MeasureSpec.UNSPECIFIED:
        result = size;
        break;
    case MeasureSpec.AT_MOST:
    case MeasureSpec.EXACTLY:
        result = specSize;
        break;
    }
    return result;
}
```

默认情况下，测量过程中并没有区分`AT_MOST`和`EXACTLY`，也就是说它实际上并没有区分`wrap_content`和`match_parent`，最终的结果都是按照`match_parent`处理的。因此，如果我们自定义`View`则必须要重写`onMeasure`来处理这两种情况。

```java
// View.java
protected final void setMeasuredDimension(int measuredWidth, int measuredHeight) {
    boolean optical = isLayoutModeOptical(this);
    if (optical != isLayoutModeOptical(mParent)) {
        Insets insets = getOpticalInsets();
        int opticalWidth  = insets.left + insets.right;
        int opticalHeight = insets.top  + insets.bottom;
        measuredWidth  += optical ? opticalWidth  : -opticalWidth;
        measuredHeight += optical ? opticalHeight : -opticalHeight;
    }
    setMeasuredDimensionRaw(measuredWidth, measuredHeight);
}

private void setMeasuredDimensionRaw(int measuredWidth, int measuredHeight) {
    mMeasuredWidth = measuredWidth;
    mMeasuredHeight = measuredHeight;

    mPrivateFlags |= PFLAG_MEASURED_DIMENSION_SET;
}
```

在前面的`measure`流程中，在`onMeasure`之后会检测flag中是否有`PFLAG_MEASURED_DIMENSION_SET`，如果没哟会直接抛出异常，这是在提醒我们重写`onMeasure`进行测量的话，测量完成后必须将测量结果通过`setMeasuredDimension`告知到`View`本身。到这里我们似乎已经看完了测量的流程，最终是走到`View`的`onMeasure`中进行测量。我们的界面并不是一个单独的`View`，而是一整颗`View`树，因此对于`ViewGroup`而言，则一定不能使用默认的`onMeasure`进行测量本身，而是应该重写该方法，在`onMeasure`的时候触发它的子`View`的测量。

我们看下`FrameLayout`是如何做的：

```java
// FrameLayout
@Override
protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
    int count = getChildCount();
    ...
    for (int i = 0; i < count; i++) {
        final View child = getChildAt(i);
        if (mMeasureAllChildren || child.getVisibility() != GONE) {
            measureChildWithMargins(child, widthMeasureSpec, 0, heightMeasureSpec, 0);
            ...
        }
    }
    ...
    setMeasuredDimension(
        resolveSizeAndState(maxWidth, widthMeasureSpec, childState),
        resolveSizeAndState(maxHeight, heightMeasureSpec, childState << MEASURED_HEIGHT_STATE_SHIFT)
    );
    ...
}
```

实际上，当我们自定义`ViewGroup`的时候也应该按照它这样操作，首先触发每个子`View`的测量，最终计算出自身的宽高，然后设置下去。其中`measureChildWithMargins`是`ViewGroup`中定义的一些列方法，可以帮助我们快速触发子`View`的测量。

```java
// ViewGroup.java


// 遍历子View，然后测量
protected void measureChildren(int widthMeasureSpec, int heightMeasureSpec) {
    final int size = mChildrenCount;
    final View[] children = mChildren;
    for (int i = 0; i < size; ++i) {
        final View child = children[i];
        if ((child.mViewFlags & VISIBILITY_MASK) != GONE) {
            measureChild(child, widthMeasureSpec, heightMeasureSpec);
        }
    }
}

// 和measureChildWithMargins一样，只是少了margin，只有padding
protected void measureChild(View child, int parentWidthMeasureSpec,
            int parentHeightMeasureSpec) {
    final LayoutParams lp = child.getLayoutParams();

    final int childWidthMeasureSpec = getChildMeasureSpec(parentWidthMeasureSpec,
            mPaddingLeft + mPaddingRight, lp.width);
    final int childHeightMeasureSpec = getChildMeasureSpec(parentHeightMeasureSpec,
            mPaddingTop + mPaddingBottom, lp.height);
    child.measure(childWidthMeasureSpec, childHeightMeasureSpec);
}

protected void measureChildWithMargins(View child,
        int parentWidthMeasureSpec, int widthUsed,
        int parentHeightMeasureSpec, int heightUsed) {
    // 获取子View的属性
    final MarginLayoutParams lp = (MarginLayoutParams) child.getLayoutParams();
    // 传入自己的测量属性，以及已经使用过的宽度：padding和margin，然后计算子View的测量属性
    final int childWidthMeasureSpec = getChildMeasureSpec(parentWidthMeasureSpec,
            mPaddingLeft + mPaddingRight + lp.leftMargin + lp.rightMargin
                    + widthUsed, lp.width);
    final int childHeightMeasureSpec = getChildMeasureSpec(parentHeightMeasureSpec,
            mPaddingTop + mPaddingBottom + lp.topMargin + lp.bottomMargin
                    + heightUsed, lp.height);
    // 将测量属性传给子View去测量
    child.measure(childWidthMeasureSpec, childHeightMeasureSpec);
}
```

`ViewGroup`给我们提供了三个方法供我们快速触发子`View`的测量。

- `measureChildren`：遍历子`View`，然后通过`measureChild`触发子`View`的测量
- `measureChild`：计算子`View`的测量属性，然后实际触发测量。
- `measureChildWithMargins`：计算子`View`的测量属性，然后实际触发测量。

当我们自定义`View`的时候，通常情况下还需要处理`LayoutParams`相关的逻辑。默认情况下使用的`LayoutParams`只支持`padding`等基础属性，而如果想要使用`margin`的话，则需要处理使其支持`MarginLayoutParams`。当子`View`不支持`margin`的时候，我们测量子`View`需要使用`measureChild`，如果所有的子`View`都不支持`margin`的话，则可以使用`measureChildren`直接触发所有的子`View`进行测量。否则的话只能使用`measureChildWithMargins`来触发。

同样的，快速获取子`View`的测量属性也是有提供的工具方法的，就是`getChildMeasureSpec`：

```java
// ViewGroup.java

public static int getChildMeasureSpec(int spec, int padding, int childDimension) {
    // 父View的测量模式和测量值
    int specMode = MeasureSpec.getMode(spec);
    int specSize = MeasureSpec.getSize(spec);
    // 实际可用的尺寸需要去掉已使用的尺寸
    int size = Math.max(0, specSize - padding);

    int resultSize = 0;
    int resultMode = 0;

    switch (specMode) {
        // 父View是精确模式
        case MeasureSpec.EXACTLY:
            if (childDimension >= 0) {
                // 如果子View设置了具体的尺寸，则也是精确模式，并使用它设置的值
                resultSize = childDimension;
                resultMode = MeasureSpec.EXACTLY;
            } else if (childDimension == LayoutParams.MATCH_PARENT) {
                // 如果子View是match_parent，则也是精确模式，并使用父View提供的值
                resultSize = size;
                resultMode = MeasureSpec.EXACTLY;
            } else if (childDimension == LayoutParams.WRAP_CONTENT) {
                // 如果子View是wrap_content, 则使用父View提供的值，并设置为最大限制模式
                resultSize = size;
                resultMode = MeasureSpec.AT_MOST;
            }
            break;

        // 父View是最大限制模式
        case MeasureSpec.AT_MOST:
            if (childDimension >= 0) {
                // 如果子View设置了具体的尺寸，则也是精确模式，并使用它设置的值
                resultSize = childDimension;
                resultMode = MeasureSpec.EXACTLY;
            } else if (childDimension == LayoutParams.MATCH_PARENT) {
                // 如果子View是match_parent，则也是最大限制模式，并使用父View提供的值
                resultSize = size;
                resultMode = MeasureSpec.AT_MOST;
            } else if (childDimension == LayoutParams.WRAP_CONTENT) {
                // 如果子View是wrap_content, 则使用父View提供的值，并设置为最大限制模式
                resultSize = size;
                resultMode = MeasureSpec.AT_MOST;
            }
            break;

        // 父View是未指定模式
        case MeasureSpec.UNSPECIFIED:
            if (childDimension >= 0) {
                // 如果子View设置了具体的尺寸，则也是精确模式，并使用它设置的值
                resultSize = childDimension;
                resultMode = MeasureSpec.EXACTLY;
            } else if (childDimension == LayoutParams.MATCH_PARENT) {
                // 如果子View是match_parent，则也是未指定模式，并使用父View提供的值
                resultSize = View.sUseZeroUnspecifiedMeasureSpec ? 0 : size;
                resultMode = MeasureSpec.UNSPECIFIED;
            } else if (childDimension == LayoutParams.WRAP_CONTENT) {
                // 如果子View是match_parent，则也是最大限制模式，并使用父View提供的值
                resultSize = View.sUseZeroUnspecifiedMeasureSpec ? 0 : size;
                resultMode = MeasureSpec.UNSPECIFIED;
            }
            break;
        }
        // 将测量模式和测量值组合成测量属性返回
        return MeasureSpec.makeMeasureSpec(resultSize, resultMode);
    }
```

实际开发中我们就可以直接使用`getChildMeasureSpec`来快速构建子`View`的测量属性，它会综合父`View`的测量属性和子`View`的布局属性来构建出子`View`的测量属性。具体可以看下面的表格：

| 子布局属性\父测量属性 | EXACTLY                    | AT_MOST                    | UNSPECIFIED                    |
| --------------------- | -------------------------- | -------------------------- | ------------------------------ |
| `match_parent`        | 模式：`EXACTLY` & 值：父值 | 模式：`AT_MOST` & 值：父值 | 模式：`UNSPECIFIED` & 值：父值 |
| `wrap_content`        | 模式：`AT_MOST` & 值：父值 | 模式：`AT_MOST` & 值：父值 | 模式：`UNSPECIFIED` & 值：父值 |
| 具体`dp`值            | 模式：`EXACTLY` & 值：子值 | 模式：`EXACTLY` & 值：子值 | 模式：`EXACTLY` & 值：子值     |

### layout

还是从`ViewRootImpl`开始触发，`View`绘制的三个流程都是在`performTraverals`中触发的。

```java
// ViewRootImpl.java
private void performTraversals() {
    ...
    // 和measure的条件是一样的
    final boolean didLayout = layoutRequested && (!mStopped || mReportNextDraw);
    if (didLayout) {
        performLayout(lp, mWidth, mHeight);
        ...
    }
    ...
}
```

进入布局的条件和前面的进入测量的条件是一样的，也就是说，`measure`和`layout`通常是一起生效的。最终通过`preformLayout`进入实际的布局阶段，其中参数`mWidth`和`mHeight`是在前面赋值的，其实际为`mWinFram`的宽高，即窗口的宽高。

```java
// ViewRootImpl.java
private void performLayout(WindowManager.LayoutParams lp, int desiredWindowWidth,
            int desiredWindowHeight) {
    mScrollMayChange = true;
    // 标记开始测量
    mInLayout = true;
    // host即为DecorView
    final View host = mView;
    if (host == null) {
       return;
    }

    try {
        // 开始实际触发布局
        host.layout(0, 0, host.getMeasuredWidth(), host.getMeasuredHeight());
        ...
    } finally {
        Trace.traceEnd(Trace.TRACE_TAG_VIEW);
    }
    mInLayout = false;
}
```

其中`host`即是`View`树中的树根节点`DecorView`，由此布局的过程进入到`View`体系中。这里不去看具体的实现，直接看`ViewGroup`中的布局流程。

```java
// ViewGroup.java
@Override
public final void layout(int l, int t, int r, int b) {
    if (!mSuppressLayout && (mTransition == null || !mTransition.isChangingLayout())) {
        if (mTransition != null) {
            mTransition.layoutChange(this);
        }
        super.layout(l, t, r, b);
    } else {
        // record the fact that we noop'd it; request layout when transition finishes
        mLayoutCalledWhileSuppressed = true;
    }
}
```

基本上是什么都没做的，最终还是回到`super.layout()`中。

```java
// View.java
public void layout(int l, int t, int r, int b) {
    // 测量过程中，如果从缓存中获取到了以前测量过的结果，是不会触发测量的，而是直接跳过测量，同时设置了该flag
    // 会在布局过程中再次触发onMeasure，
    if ((mPrivateFlags3 & PFLAG3_MEASURE_NEEDED_BEFORE_LAYOUT) != 0) {
        onMeasure(mOldWidthMeasureSpec, mOldHeightMeasureSpec);
        mPrivateFlags3 &= ~PFLAG3_MEASURE_NEEDED_BEFORE_LAYOUT;
    }

    int oldL = mLeft;
    int oldT = mTop;
    int oldB = mBottom;
    int oldR = mRight;

    // 在setFrame中，会判断这四个值是否发生了变化，如果变化了，则重新赋值并返回true
    boolean changed = isLayoutModeOptical(mParent) ?
            setOpticalFrame(l, t, r, b) : setFrame(l, t, r, b);

    // 如果宽高发生了变化，或者触发过measure测量，则重新布局。这个flag是测量时赋值的
    if (changed || (mPrivateFlags & PFLAG_LAYOUT_REQUIRED) == PFLAG_LAYOUT_REQUIRED) {
    	// 触发布局，在ViewGroup中是抽象方法，在View中是空实现
        onLayout(changed, l, t, r, b);
        mPrivateFlags &= ~PFLAG_LAYOUT_REQUIRED;
        ...
    }
    ...
}
```

 在`layout`中可以看到还会调用了一次`onMeasure`，这是因为在`measure`时，如果新的宽高属性在之前已经被测量过并且还在缓存中存储时，是不会去通过`onMeasure`继续测量的，而是直接设置为缓存的宽高，并通过设置`flag`将`onMeasure`延迟到了`layout`流程中。本身引入缓存的机制是为了节省一次测量流程的，但是实际上很多`View`还是依赖`onMeasure`的，因此不能完全省略，而是将其延迟到了`layout`前执行，这样可以将`performTraverals`中可能出现的多次测量的过程缩减到一次，整体上还是提高了测量的效率的。

然后就是设置它本身的宽高，如果上下左右的坐标发生了变化，或者前面测量过，则通过`onLayout`将布局流程继续分发下去。`onLayout`是一个空实现，但是在`ViewGroup`中被重写为抽象方法。因此，如果我们是自定义`View`，实际上是不需要处理这个方法的，因为我们的位置是由父布局来设置的；但是如果我们是自定义的`ViewGroup`中，则必须要重写该方法，并在该方法中去布局它自己的子`View`。

例如我们看`FrameLayout`的实现：

```java
// FrameLayout.java
@Override
protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
    layoutChildren(left, top, right, bottom, false /* no force left gravity */);
}

void layoutChildren(int left, int top, int right, int bottom, boolean forceLeftGravity) {
    final int count = getChildCount();
    ...
    for (int i = 0; i < count; i++) {
        final View child = getChildAt(i);
        if (child.getVisibility() != GONE) {
            ...
            child.layout(childLeft, childTop, childLeft + width, childTop + height);
        }
    }
}
```

实际看到就是计算需要给子`View`布局的左右坐标，然后通过`layout`方法继续将布局流程给到子`View`。需要注意的就是在`onLayout`中，坐标值实际上是相对于父布局的，因此如果一个`View`被放置在父布局的左上角，那么在`onLayout`中的`left`和`top`值均为0。

### draw

同样的，还在从`ViewRootImpl`中触发，然后回到`View`中。

```java
// ViewRootImpl.java
private void performTraversals() {
    if (!isViewVisible) {
       ...
       // 界面不可见
    } else if (cancelAndRedraw) {
       // 重新触发三个流程
       scheduleTraversals();
    } else {
        ....
        // 通过performDraw触发绘制
        if (!performDraw() && mActiveSurfaceSyncGroup != null) {
            mActiveSurfaceSyncGroup.markSyncReady();
        }
    }
}

private boolean performDraw() {
    ...
    final boolean fullRedrawNeeded = mFullRedrawNeeded || mActiveSurfaceSyncGroup != null;
    mFullRedrawNeeded = false;
    mIsDrawing = true;
    ...
    try {
        // 绘制
        boolean canUseAsync = draw(fullRedrawNeeded, usingAsyncReport && mSyncBuffer);
        ...
    } finally {
        mIsDrawing = false;
    }
    return true;
}
```

最终触发到`draw`方法中，这里实际还没有到`view`中，因为这里涉及`surface`以及硬件加速，所以会有很多的流程，才会走到`view`中。

```java
private boolean draw(boolean fullRedrawNeeded, boolean forceDraw) {
    ...
    final float appScale = mAttachInfo.mApplicationScale;
    final Rect dirty = mDirty;
    // 记录上次的Rect
    if (fullRedrawNeeded) {
        dirty.set(0, 0, (int) (mWidth * appScale + 0.5f), (int) (mHeight * appScale + 0.5f));
    }
    // ViewTreeObserver.onDraw
    mAttachInfo.mTreeObserver.dispatchOnDraw();
    ...
    boolean useAsyncReport = false;
    if (!dirty.isEmpty() || mIsAnimating || accessibilityFocusDirty) {
        if (isHardwareEnabled()) {
            // 开启了硬件加速
            mAttachInfo.mThreadedRenderer.draw(mView, mAttachInfo, this);
        } else {
            ...
            if (!drawSoftware(surface, mAttachInfo, xOffset, yOffset,
                    scalingRequired, dirty, surfaceInsets)) {
                return false;
            }
        }
    }
    ...
    return useAsyncReport;
}


private boolean drawSoftware(Surface surface, AttachInfo attachInfo, int xoff, int yoff,
    boolean scalingRequired, Rect dirty, Rect surfaceInsets) {

    // Draw with software renderer.
    final Canvas canvas;
    ...
    try {
        // 根据偏移移动画布
        canvas.translate(-xoff, -yoff);
        if (mTranslator != null) {
            mTranslator.translateCanvas(canvas);
        }
        canvas.setScreenDensity(scalingRequired ? mNoncompatDensity : 0);
        // 进入到View的绘制流程
        mView.draw(canvas);
        drawAccessibilityFocusedDrawableIfNeeded(canvas);
    } finally {
        ...
    }
    return true;
}
```

我们的`View`的绘制流程，实际上是属于软件绘制的，也就是`drawSoftware`，最终走到`View`的绘制流程中。注意在`ViewGroup`是没有重写`draw`的，因此最终走到的是在`view`中。

```java
@CallSuper
public void draw(Canvas canvas) {

    /*
     *      1. 绘制背景
     *      2. 保存画布等待做渐隐边界
     *      3. 绘制View的内容
     *      4. 绘制子View
     *      5. 恢复画布并做渐隐边界
     *      6. 绘制滚动条
     *      7. 绘制焦点的高亮
     */

    // 步骤1，绘制背景
    int saveCount;
    drawBackground(canvas);

    final int viewFlags = mViewFlags;
    boolean horizontalEdges = (viewFlags & FADING_EDGE_HORIZONTAL) != 0;
    boolean verticalEdges = (viewFlags & FADING_EDGE_VERTICAL) != 0;
    // 如果没有渐隐渐现的边界要求，则跳过步骤2和5
    if (!verticalEdges && !horizontalEdges) {
        // 步骤3，绘制自身内容
        onDraw(canvas);
        // 步骤4，绘制子View
        dispatchDraw(canvas);
        // 步骤6，绘制前景和滚动条
        onDrawForeground(canvas);
        // 步骤7，绘制焦点高亮
        drawDefaultFocusHighlight(canvas);
         // 绘制结束
         return;
    }
    // 后面的流程没有省略步骤2和5，按顺序绘制的
    ...
}
```

绘制流程一共分了7个步骤，其他的我们基本上不需要去关注，基本上只需要关注步骤3即可。通常情况下，如果我们是自定义`ViewGroup`是不需要关注绘制的，如果是自定义`View`，则需要重写`onDraw`，然后在画布中绘制我们想要的界面内容即可。这个方法在`View`中也是一个空实现，等待我们重写并进行自定义绘制。

### 总结

到这里，基本上`View`的绘制流程已经看完了，主要就是由`ViewRootImpl`触发的`performTraversals`，进入触发到`View`树的测量、布局、绘制三个流程。对于应用开发而言，如果是自定义`ViewGroup`，则重写`onMeasure`测量自身并触发子`View`的测量，然后重写`onLayout`触发子`View`的布局；如果是自定义`View`，则重写`onMeasure`测量自身，然后重写`onDraw`绘制自身内容即可。



