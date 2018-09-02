# mp3player

> 一个用来播放 mp3 音频文件的网页播放器。通过 ajax 获取数据，使用 audiocontext 或 mediasource 播放。可边播放边下载，下载完成后可对音频数据进行二次处理。

## 内容

- [**`浏览器兼容性`**](#浏览器兼容性)
- [**`功能特性`**](#功能特性)
- [**`安装`**](#安装)
- [**`使用`**](#使用)
- [**`案例`**](#案例)
- [**`Player构造函数`**](#Player构造函数)   
- [**`贡献`**](#贡献)

## 浏览器兼容性

| [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/edge.png" alt="IE" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>IE | [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/firefox.png" alt="Firefox" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>Firefox | [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/chrome.png" alt="Chrome" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>Chrome | [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/safari.png" alt="Safari" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>Safari | [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/safari-ios.png" alt="iOS Safari" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>iOS | [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/chrome-android.png" alt="Chrome for Android" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>Android |
|:---------:|:---------:|:---------:|:---------:|:---------:|:---------:|
| IE11+ | &check;| &check; | &check; | &check; | &check; | &check;

## 功能特性
* [x] 支持使用原生 JavaScript 解码mp3（修改了 jsmad）
* [x] 支持使用 mediasource 播放音频
* [x] 支持对音频数据进行再次处理
* [x] 持续维护迭代

## 安装

### NPM

```bash
npm install mp3player --save
```

## 使用

### 开发

```bash
npm run dev
```

### 编译案例

```bash
npm run build:example
```

### 编译生产环境

```bash
npm run build:prod
```

## 案例

请查看[**`example`**](https://github.com/wanls4583/mp3player/tree/master/src/example)

## Player构造函数

|option|description|default|val|
|:---|---|---|---|
|`usemediasource`|是否使用 mediasource 播放音频（默认使用 audiocontext 播放音频）|`false`|`Boolean`|
|`onloadedmetadata`|元数据解析成功回调|`function(){}`|`Function`|
|`ontimeupdate`|播放时长更新回调|`function(){}`|`Function`|
|`onplay`|开始播放回调|`function(){}`|`Function`|
|`onpause`|暂停回调|`function(){}`|`Function`|
|`onwaiting`|加载中回调|`function(){}`|`Function`|
|`onplaying`|缓冲完成回调|`function(){}`|`Function`|
|`onend`|播放结束回调|`function(){}`|`Function`|
|`onbeforedecode`|数据拉取成功回调（可对数据进行二次处理，例如解密等工作）|`function(){}`|`Function`|


## 贡献

欢迎给出一些意见和优化，期待你的 `Pull Request`