
// 防抖函数，300毫秒内只会执行一次fun函数
function debounce(fun) {
    return function() {
        if(fun.id) {
            return
        }
        fun()
        fun.id = setTimeout(function(){
            fun.id = undefined
        }, 300)
    }
}

// 初始化滚动和高亮监听
function setup() {
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
    
    const slop = 50
    
    // 添加布局滚动的监听
    document.addEventListener('scroll', function() {
        debounce(onPageScroll)()
    })
    onPageScroll()
    function onPageScroll() {
        // 计算当前应该显示那条标题
        let lastPosition = currentIndex
        computeShowTitle()
        if(lastPosition != currentIndex || firstLoad) {
            tocItems[lastPosition].classList.remove('active')
            tocItems[currentIndex].classList.add('active')
            firstLoad = false
        }
        // 计算当前滚动的位置
        let offsetRelative = tocItems[currentIndex].getBoundingClientRect().top - tocContainer.getBoundingClientRect().top
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
};

setup()