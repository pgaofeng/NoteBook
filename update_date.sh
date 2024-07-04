#!/bin/bash  
  
directory="source/_posts"  
  
# 遍历指定文件夹中的所有.txt文件  
find "$directory" -type f -name "*.md" -exec bash -c '  
    filename="$1"
    # 替换成当前文件的最近的git更新时间
    new_timestamp=$(git log -1 --format="%ai" -- $filename)
    git log -1 --format="%ai" -- $filename
    
    # 尝试替换update_data:后面的时间  
    sed -i "/update_data:/s/\(update_data: \).*/\1$new_timestamp/" "$filename"  
  
    # 检查替换是否成功（即原始文件中是否包含这一行）  
    if ! grep -q "update_data: $new_timestamp" "$filename"; then  
        # 如果替换没有成功（即原始文件中没有这一行），则插入到第二行   
       # sed -i "/^---$/ \\update_data: $new_timestamp" "$filename"  
        sed -i "0,/^---$/ {n;i\\
update_data: $new_timestamp
        }" "$filename"
    fi  
' bash {} \;