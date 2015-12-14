## TODO

- ASG StringでNote以外の情報


# MG

## インストール

```
$ brew install node
$ git clone https://github.com/takayukihamano/asg
$ cd asg
$ ./install.sh

# ローカルレンダリングする場合は以下もインストール
$ curl -O http://takayukihamano.net/tmp/titanic.sf2
$ brew install brew-cask
$ brew cask install mactex
$ brew install lilypond sox fluidsynth
```

## 実行

### ファイルの実行

```
$ asg input.ac
$ asg input.ac --local  # ローカルコンピュータでレンダリング
$ asg input.ac --remote # リモートサーバでレンダリング
```

### REPL

```
$ asg
>
> p # タブキーを押すと、入力候補が表示される。
push   pop    print  

> note \ # TODO
> ... time 2
> ... pitch 72
> ... # 2回Returnを押すと完了する。
> 
```

## シンタックス

### コメント

```
# comment
```

### 関数の実行
```
# 引数を直接指定
note 0 1 62 80

# 引数名で指定（上記と等価）
note
	time 0
	duration 1
	pitch 62
	velocity 80

note # 引数は省略可能

scale [0 4 6 7 11] 3 # 配列の引数
```

#### 式の評価

丸括弧で括った引数は式として評価される。

```
note 0 2 (60 + 7) # note 0 2 67 となる。
```

#### 繰り返し修飾子

```
*3 note ($i * 2) 1  (60 + $i) # 3回繰り返す。$iにインデックスが代入される。
```

```
*16 note ($i * 0.5) 0.5 (($i % 2) * 12 + $i + 60)

# 下記は上記と等価
*16 note
    time ($i * 0.25)
    duration 0.25
    pitch (($i % 2) * 12 + $i + 60)
```

```
*32 note ($i * 0.25) 0.25 (Math.sin(($i / 32) * Math.PI * 2) * 32 + 60)
```

### スタックのクリア

```
---
```

### スタックの保存と読み込み

```
note 0 1 60 80
note 1 3 50 80
=> varA

---
note 0 3 62 80
note 3 1 72 80
=> varB

---
note 3 1 72 80
=>+ varB 2 # 追加（オフセット時間指定）

---
<= varA
<= varB 4 # オフセット時間指定
write abc
```

### スタックのプッシュ／ポップ

```
*16 note ($i * 0.25) 0.25 (60 + $i)

=> a

( # プッシュ（現在の状態を保存する）
invert
=> b
(
add pitch 5
=> c
) # ポップ（一つ前の状態に戻す）
=> d
)

---

<= d
write a
```

### 関数の作成

```
>>> funcA
note 0 3 60 80
move pitch 3
<<< funcA
---
funcA
```

#### 関数の引数

```
>>> funcA $hello $world
note 1.00 0.25 $hello
note 1.25 0.25 $world
note 1.50 0.25 $hello
note 1.75 0.25 $world
<<< funcA

---

>>> funcB $hello $world
funcA $hello $world
<<< funcB

---

funcB 60 72
```

#### 関数に対する繰り返し

```
>>> makenote $i
note ($i * 0.25) 0.25 ([64, 66, 71, 73, 74, 66, 64, 73, 71, 66, 74, 73][$i])
<<< makenote

*12 makenote $i
```

```
>>> make $i $t $p
note
    time ($i * 0.25 + $t)
    duration 0.25
    pitch (($i % 2) * 12 + $i + 60 + $p)
<<< make

*16 make $i 0 0
*24 make $i 2.5 -7
*32 make $i 3.5 -14
```

### JavaScriptコードの実行

- lodashモジュールを使用可能。

```
{
	// JavaScriptコード
	this.$a = 72; // 式で再利用する変数には必ず $ をつける。
}

note 0 2 $a
```

```
{
	this.$a = _.times(16, function (i) {
	    return 60 + [i % 3] * 2 + i * 0.5;
	});
}

*16 note ($i * 0.5) 0.5 ($a[$i])
```

### ファイルのインクルード

```
include sub.ac
```

### パターンの指定

下記の記号を組み合わせた文字列で指定する。

- * 有効
- - 無効

```
invert
	pattern *-*--
```

## リファレンス

### ---

現在のスタックを空にする。

### =>

現在のスタックに名前をつけて保存する。

### =>+

指定したスタックに現在のスタックの内容を追加する。

### <=

指定したスタックの内容を現在のスタックに取り込む。

### show_stacks

スタックのリストを表示する。

### delete

指定したスタックを削除する。

- 引数0: name (string, default: '-')

### (

スタックをプッシュする。

### )

スタックをポップする。

### print

指定したスタックの内容を表示する。nameが指定されない場合は、現在のスタックを表示する。

- 引数0: name (string, default: '-')

### exit

### ?

ヘルプを表示する。

- 引数0: name (string)

### to_string

指定したスタックの内容をJSON形式に変換する。nameが指定されない場合は、現在のスタックを変換する。

- 引数0: name (string, default: '-')

### from_string

JSONデータを解釈して現在のスタックに取り込む。

- 引数0: string (string)
- 引数1: name (string, default: '-')

### save_string

スタックの内容をファイルに書き出す。

- 引数0: file (string, default: 'out.acs')
- 引数1: name (string, default: '-')

### load_string

ファイルからスタックに読み込む。

- 引数0: file (string, default: 'out.acs')
- 引数1: name (string, default: '-')

### history



### set_state

状態を設定する。（これ以降に追加されたノートに対して適用）

- 引数0: target (string, default: 'track')
- 引数1: value (float, default: 0)

### clear_state

状態を解除する。

- 引数0: target (string, default: 'track')

### tempo

指定した時間以降のテンポを変更する。

- 引数0: time (float, default: 0)
- 引数1: value (float, default: 120)

### instrument

トラックに楽器を割り当てる。

- 引数0: track (integer, default: 0)
- 引数1: value (integer, default: 0)

### pan

トラックにパンニングを割り当てる。

- 引数0: track (integer, default: 0)
- 引数1: value (integer, default: 64)

### expression

エクスプレッションデータを挿入する。

- 引数0: track (integer, default: 0)
- 引数1: time (integer, default: 0)
- 引数2: value (integer, default: 64)

### note

スタックにノートを追加する。

- 引数0: time (float, default: 0)
- 引数1: duration (float, default: 1)
- 引数2: pitch (integer, default: 60)
- 引数3: velocity (integer, default: 80)

### update

ひとつのデータに対し、指定したターゲットに値を設定する。

- 引数0: index (integer, default: 0)
- 引数1: target (string, default: 'pitch')
- 引数2: value (float, default: 1)

### update_all

スタックの全てのデータに対し、指定したターゲットに値を設定する。

- 引数0: target (string, default: 'pitch')
- 引数1: value (float, default: 1)
- 引数2: pattern (string, default: '*')

### write

スタックデータから音楽を書き出す。

- 引数0: name (string, default: 'out')
- 引数1: offset (float, default: 0)

### add

ひとつのデータに対し、指定したターゲットに値を加算する。

- 引数0: index (integer, default: 0)
- 引数1: target (string, default: 'pitch')
- 引数2: value (float, default: 1)

### add_all

スタックの全てのデータに対し、指定したターゲットに値を加算する。

- 引数0: target (string, default: 'pitch')
- 引数1: value (float, default: 1)
- 引数2: pattern (string, default: '*')

### articulation

- 引数0: pattern (string, default: '*')

### clip

- 引数0: target (string, default: 'pitch')
- 引数1: min (float, default: 60)
- 引数2: max (float, default: 64)

### compact

### concat

- 引数0: sequences (array, default: [])
- 引数1: interval (array, default: [])

### filter

- 引数0: target (string, default: 'pitch')
- 引数1: min (float, default: 63)
- 引数2: max (float, default: 68)
- 引数3: pattern (string, default: '*')
- 引数4: end_mode (string, default: 'inclusive')

### filter_out

- 引数0: target (string, default: 'pitch')
- 引数1: min (float, default: 63)
- 引数2: max (float, default: 68)
- 引数3: pattern (string, default: '*')
- 引数4: end_mode (string, default: 'inclusive')

### invert

- 引数0: pattern (string, default: '*')

### limit_pitch

- 引数0: min (float, default: 60)
- 引数1: max (float, default: 64)
- 引数2: pattern (string, default: '*')

### line

- 引数0: target (string, default: 'pitch')
- 引数1: from (float, default: -12)
- 引数2: to (float, default: 12)
- 引数3: mode (string, default: 'add')
- 引数4: pattern (string, default: '*')

### monophony

- 引数0: type (string, default: 'A')
- 引数1: criterion (string, default: 'pitch')

### no_repetition

### remove

- 引数0: index (string, default: '*')

### remove_all

- 引数0: pattern (string, default: '*')

### repeat

- 引数0: n (integer, default: 3)
- 引数1: interval (array, default: [1])
- 引数2: transpose (array, default: [1])

### reverse

- 引数0: pattern (string, default: '*')

### scale

- 引数0: pitch_set (array, default: [0, 4, 5, 7, 11]
- 引数1: key (integer, 0)
- 引数2: pattern (string, '*')
- 引数3: harmonic_threshold (float, default: 0.5)

### shift

- 引数0: amount (integer, default: 2)
- 引数1: pattern (string, default: '*')
- 引数2: mode (string, default: 'shift')

### shuffle

- 引数0: pattern (string, default: '*')

### stretch

- 引数0: stretch (float, default: 2)
- 引数1: quantize (float, default: 1)

### legato

- 引数0: max_interval (float, default: 2)

### trim

- 引数0: from (integer, default: 1)
- 引数1: to (integer, default: 3)
- 引数2: remove_offset (string, default: 'yes')

### trim_last

- 引数0: n (integer, default: 3)
- 引数1: remove_offset (string, default: 'yes')


### wrap

- 引数0: min (integer, default: 60)
- 引数1: max (integer, default: 64)
- 引数2: pattern (string, default: '*')

