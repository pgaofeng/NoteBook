document.addEventListener('DOMContentLoaded', () => {
    let firstLoad = true
    // 当前滚动的位置
    let currentIndex = 0
    // 目录的条目
    let tocItems = document.querySelectorAll('.toc-link')
    // 对应目录的标题
    let titleItems = document.querySelectorAll('.headerlink')
    let lastYOffset = window.pageYOffset
    let tocContainer = document.querySelector('.toc')
    let mainContainer = document.querySelector('.main-column')
    let mLastTime = 0
    const slop = 50
    
    // 添加布局滚动的监听
    document.addEventListener('scroll', onPageScroll)
    onPageScroll()
    function onPageScroll() {
        // 防抖
        if(performance.now() - mLastTime < 300) {
            return
        }
        mLastTime = performance.now()
        // 计算当前应该显示那条标题
        let lastPosition = currentIndex
        computeShowTitle()
        if(lastPosition != currentIndex || firstLoad) {
            tocItems[lastPosition].classList.remove('active')
            tocItems[currentIndex].classList.add('active')
            firstLoad = false
        }
        // 计算当前滚动的位置
        let offsetRelative = 0
        for(i = 0; i < currentIndex; i++) {
            offsetRelative += tocItems[currentIndex].clientHeight
        }
        let targetOffset = offsetRelative - (tocContainer.clientHeight - tocItems[currentIndex].clientHeight) / 2
        tocContainer.scrollTo({top: targetOffset, behavior: 'auto'})
        
    }
    // 计算当前应该显示那条标题
    function computeShowTitle() {
        let last = lastYOffset
        lastYOffset = window.pageYOffset
        // 滚动条向下移动
        if(last < window.pageYOffset) {
            do {
                // 滚动到最后一个条目了
                if(currentIndex == titleItems.length -1) {
                   return
                }
                let nextTop
                if (currentIndex + 1 < titleItems.length) {
                    nextTop = titleItems[currentIndex + 1].getBoundingClientRect().top
                }
                if(nextTop < slop) {
                    currentIndex ++
                } else {
                    return
                }
            } while(currentIndex < titleItems.length);   
        } else {
            // 滚动条向上移动
            do {
                // 滚动到第一个条目了
               if(currentIndex == 0) {
                   return
               } 
               let currTop = titleItems[currentIndex].getBoundingClientRect().top
               if(currTop > slop) {
                   currentIndex --
               } else {
                   return
               }
            } while(currentIndex > 0)
        }
    }
});