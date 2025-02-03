document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('videoPlayer');
    const videoInput = document.getElementById('videoInput');
    const xCoordSpan = document.getElementById('xCoord');
    const yCoordSpan = document.getElementById('yCoord');
    const timeStampSpan = document.getElementById('timeStamp');
    const addDataButton = document.getElementById('addData');
    const dataTable = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
    const prevFrameButton = document.getElementById('prevFrame');
    const nextFrameButton = document.getElementById('nextFrame');
    const currentFrameSpan = document.getElementById('currentFrame');
    const totalFramesSpan = document.getElementById('totalFrames');
    const frameRateInput = document.getElementById('frameRate');
    const exportButton = document.getElementById('exportCSV');
    const seekBar = document.getElementById('seekBar');
    const volumeBar = document.getElementById('volumeBar');
    const currentTimeSpan = document.getElementById('currentTime');
    const durationSpan = document.getElementById('duration');
    const playPauseButton = document.getElementById('playPauseButton');
    
    let currentCoords = {
        x: null,
        y: null,
        time: null
    };
    
    let dataCount = 0;
    let frameRate = 30;

    // フレームレート変更の処理
    frameRateInput.addEventListener('change', function() {
        frameRate = Number(this.value);
        updateFrameInfo();
    });

    // 再生/一時停止の切り替え
    playPauseButton.addEventListener('click', async function() {
        try {
            if (video.paused) {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    await playPromise;
                    playPauseButton.textContent = '一時停止';
                }
            } else {
                await video.pause();
                playPauseButton.textContent = '再生';
            }
        } catch (error) {
            console.error('再生/一時停止の切り替え中にエラーが発生:', error);
            // エラー時は再生ボタンに戻す
            playPauseButton.textContent = '再生';
        }
    });

    // 動画の準備完了イベント
    video.addEventListener('canplay', function() {
        playPauseButton.disabled = false;
    });

    // 動画終了時のイベント
    video.addEventListener('ended', function() {
        playPauseButton.textContent = '再生';
    });

    // シークバーの更新
    video.addEventListener('timeupdate', function() {
        const value = (video.currentTime / video.duration) * 100;
        seekBar.value = value;
        currentTimeSpan.textContent = formatTime(video.currentTime);
        updateFrameInfo();
    });

    // シークバーでの移動
    seekBar.addEventListener('change', function() {
        const time = (seekBar.value / 100) * video.duration;
        video.currentTime = time;
    });

    // 音量調整
    volumeBar.addEventListener('input', function() {
        video.volume = volumeBar.value;
    });

    // フレーム移動関数
    function updateFrameInfo() {
        const currentTime = video.currentTime;
        const totalTime = video.duration || 0;
        const currentFrame = Math.floor(currentTime * frameRate);
        const totalFrames = Math.floor(totalTime * frameRate);
        
        currentFrameSpan.textContent = currentFrame;
        totalFramesSpan.textContent = totalFrames;
        
        prevFrameButton.disabled = currentFrame <= 0;
        nextFrameButton.disabled = currentFrame >= totalFrames - 1;
    }

    // 時間をフォーマットする関数
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // 前フレームへ移動
    prevFrameButton.addEventListener('click', function() {
        const frameTime = 1 / frameRate;
        video.currentTime = Math.max(0, video.currentTime - frameTime);
    });

    // 次フレームへ移動
    nextFrameButton.addEventListener('click', function() {
        const frameTime = 1 / frameRate;
        video.currentTime = Math.min(video.duration, video.currentTime + frameTime);
    });

    // フレームレート取得関数
    async function getVideoFrameRate(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const videoElement = document.createElement('video');
                videoElement.preload = 'metadata';

                videoElement.onloadedmetadata = function() {
                    let frameRate = 30;

                    if (videoElement.mozPresentedFrames && videoElement.mozFrameDelay) {
                        frameRate = 1000 / (videoElement.mozFrameDelay * 1000);
                    } else if (videoElement.webkitDecodedFrameCount) {
                        const time = videoElement.duration;
                        const frames = videoElement.webkitDecodedFrameCount;
                        frameRate = frames / time;
                    } else if ('requestVideoFrameCallback' in videoElement) {
                        let lastTime = 0;
                        let frameCount = 0;
                        const frames = [];
                        
                        const frameCallback = (now, metadata) => {
                            if (lastTime) {
                                const delta = metadata.mediaTime - lastTime;
                                if (delta > 0) {
                                    frames.push(1 / delta);
                                }
                            }
                            lastTime = metadata.mediaTime;
                            frameCount++;
                            
                            if (frameCount < 10) {
                                videoElement.requestVideoFrameCallback(frameCallback);
                            } else {
                                frameRate = frames.reduce((a, b) => a + b, 0) / frames.length;
                                resolve({
                                    frameRate: Math.round(frameRate * 100) / 100
                                });
                            }
                        };
                        
                        videoElement.requestVideoFrameCallback(frameCallback);
                        return;
                    }

                    resolve({
                        frameRate: Math.round(frameRate * 100) / 100
                    });
                };

                videoElement.src = e.target.result;
            };

            reader.readAsDataURL(file);
        });
    }

    // 動画ファイル選択の処理
    videoInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (file) {
            try {
                // 以前のURLオブジェクトがある場合は解放
                if (video.src) {
                    URL.revokeObjectURL(video.src);
                }
                
                // 再生ボタンを一時的に無効化
                playPauseButton.disabled = true;
                playPauseButton.textContent = '再生';
                
                // 動画を一時停止
                try {
                    await video.pause();
                } catch (err) {
                    console.log('一時停止処理をスキップ');
                }
                
                const videoUrl = URL.createObjectURL(file);
                video.src = videoUrl;
                
                // メタデータの読み込みを待つ
                const onMetaLoaded = async () => {
                    try {
                        const mediaInfo = await getVideoFrameRate(file);
                        if (mediaInfo && mediaInfo.frameRate) {
                            frameRate = mediaInfo.frameRate;
                            frameRateInput.value = frameRate;
                        }

                        currentFrameSpan.textContent = '0';
                        totalFramesSpan.textContent = Math.floor(video.duration * frameRate);
                        seekBar.value = 0;
                        seekBar.max = 100;
                        durationSpan.textContent = formatTime(video.duration);
                        
                        // 再生の準備ができたらボタンを有効化
                        video.addEventListener('canplay', function onCanPlay() {
                            playPauseButton.disabled = false;
                            video.removeEventListener('canplay', onCanPlay);
                        });
                        
                    } catch (error) {
                        console.error('フレームレート取得エラー:', error);
                        frameRate = 30;
                        frameRateInput.value = frameRate;
                    }
                    
                    video.removeEventListener('loadedmetadata', onMetaLoaded);
                };
                
                video.addEventListener('loadedmetadata', onMetaLoaded);
                video.load();
                
            } catch (error) {
                console.error('動画ファイル読み込みエラー:', error);
                alert('動画ファイルの読み込み中にエラーが発生しました。');
            }
        }
    });

    // クリックイベントの処理
    video.addEventListener('click', function(e) {
        e.preventDefault();

        const rect = video.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const scaleX = video.videoWidth / rect.width;
        const scaleY = video.videoHeight / rect.height;

        const actualX = Math.round(x * scaleX);
        const actualY = Math.round(video.videoHeight - (y * scaleY));

        const currentTime = video.currentTime;

        xCoordSpan.textContent = actualX;
        yCoordSpan.textContent = actualY;
        timeStampSpan.textContent = currentTime.toFixed(3);

        currentCoords = {
            x: actualX,
            y: actualY,
            time: currentTime
        };
    });

    // データ追加ボタンの処理
    addDataButton.addEventListener('click', function() {
        if (currentCoords.x === null) return;

        dataCount++;
        const row = dataTable.insertRow();
        
        row.insertCell(0).textContent = dataCount;
        row.insertCell(1).textContent = currentCoords.x;
        row.insertCell(2).textContent = currentCoords.y;
        row.insertCell(3).textContent = currentCoords.time.toFixed(3);
        
        const noteCell = row.insertCell(4);
        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.className = 'note-input default-invible';
        noteInput.placeholder = '補足を入力';
        noteCell.appendChild(noteInput);

        const deleteCell = row.insertCell(5);
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '削除';
        deleteButton.className = 'delete-button default-invible';
        deleteButton.onclick = function() {
            dataTable.removeChild(row);
        };
        deleteCell.appendChild(deleteButton);
    });

    // CSV出力関数
    function exportToCSV() {
        try {
            const tbody = dataTable.getElementsByTagName('tbody')[0];
            const rows = Array.from(tbody.getElementsByTagName('tr'));
            
            if (rows.length === 0) {
                alert('出力するデータがありません。');
                return;
            }

            const csvContent = [
                ['No.', 'X座標', 'Y座標', '時間(秒)', '補足']
            ];

            for (const row of rows) {
                try {
                    const cells = Array.from(row.cells);
                    const noteInput = cells[4].querySelector('input');
                    const rowData = [
                        cells[0].textContent || '',
                        cells[1].textContent || '',
                        cells[2].textContent || '',
                        cells[3].textContent || '',
                        noteInput ? (noteInput.value || '') : ''
                    ];
                    csvContent.push(rowData);
                } catch (err) {
                    console.error('行データの処理中にエラーが発生:', err);
                    continue;
                }
            }

            const csv = csvContent.map(row => 
                row.map(cell => {
                    // nullやundefinedを空文字列に変換
                    const value = cell || '';
                    // カンマやダブルクォートを含む場合の処理
                    return value.includes(',') || value.includes('"') 
                        ? `"${value.replace(/"/g, '""')}"` 
                        : value;
                }).join(',')
            ).join('\n');

            // BOMを追加してUTF-8でエンコード
            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8' });
            
            // ファイル名に現在の日時を追加
            const date = new Date();
            const timestamp = date.getFullYear() +
                ('0' + (date.getMonth() + 1)).slice(-2) +
                ('0' + date.getDate()).slice(-2) +
                '_' +
                ('0' + date.getHours()).slice(-2) +
                ('0' + date.getMinutes()).slice(-2) +
                ('0' + date.getSeconds()).slice(-2);
            const fileName = `click_data_${timestamp}.csv`;

            try {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // URLの解放は少し遅延させる
                setTimeout(() => {
                    URL.revokeObjectURL(link.href);
                }, 100);
            } catch (err) {
                console.error('ファイルのダウンロード中にエラーが発生:', err);
                alert('ファイルのダウンロード中にエラーが発生しました。');
            }
        } catch (err) {
            console.error('CSVファイルの生成中にエラーが発生:', err);
            alert('CSVファイルの生成中にエラーが発生しました。');
        }
    }

    // エクスポートボタンのクリックイベント
    exportButton.addEventListener('click', exportToCSV);

    // エラー処理
    video.addEventListener('error', function(e) {
        console.error('動画の読み込み中にエラーが発生しました:', e);
    });
});