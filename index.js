const express = require("express");
const cors = require("cors");
var fs = require("fs");

const app = express();
app.use(cors());
app.options("*", cors());
// 加入這兩行
const server = require("http").Server(app);
const io = require("socket.io")(server);
var spawn = require("child_process").spawn;

app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:8888");

  // Request methods you wish to allow
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");

  // Request headers you wish to allow
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type");

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader("Access-Control-Allow-Credentials", true);

  // Pass to next layer of middleware
  next();
});

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

spawn("ffmpeg", ["-h"]).on("error", function (m) {
  console.error("FFMpeg not found in system cli; please install ffmpeg properly or make a softlink to ./!");
  process.exit(-1);
});

// 當發生連線事件
io.on("connection", (socket) => {
  console.log("Hello!"); // 顯示 Hello!
  // 加入這一段
  // 接收來自前端的 greet 事件
  // 然後回送 greet 事件，並附帶內容
  socket.on("greet", () => {
    // socket.emit("greet", "Hi! Client.??");
    var data = "";

    // 创建可读流
    var readerStream = fs.createReadStream("input.txt");

    // 设置编码为 utf8。
    readerStream.setEncoding("UTF8");

    // 处理流事件 --> data, end, and error
    readerStream.on("data", function (chunk) {
      socket.emit("greet", chunk);

      console.log("readoing..");
    });

    readerStream.on("end", function () {
      console.log(";程序执行完毕");
    });

    readerStream.on("error", function (err) {
      console.log(err.stack);
    });

    // console.log("程序执行完毕");
  });
  var ops = [
    "-i",
    "-",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency", // video codec config: low latency, adaptive bitrate
    "-c:a",
    "aac",
    "-ar",
    "44100",
    "-b:a",
    "64k", // audio codec config: sampling frequency (11025, 22050, 44100), bitrate 64 kbits
    "-y", //force to overwrite
    "-use_wallclock_as_timestamps",
    "1", // used for audio sync
    "-async",
    "1", // used for audio sync
    //'-filter_complex', 'aresample=44100', // resample audio to 44100Hz, needed if input is not 44100
    //'-strict', 'experimental',
    "-bufsize",
    "1000",
    "-f",
    "flv",
    "rtmp://localhost/live/show",
  ];

  console.log(socket._rtmpDestination);
  ffmpeg_process = spawn("ffmpeg", ops);
  feedStream = function (data) {
    ffmpeg_process.stdin.write(data);
    //write exception cannot be caught here.
  };

  ffmpeg_process.stderr.on("data", function (d) {
    socket.emit("ffmpeg_stderr", "" + d);
  });
  ffmpeg_process.on("error", function (e) {
    console.log("child process error" + e);
    socket.emit("fatal", "ffmpeg error!" + e);
    feedStream = false;
    socket.disconnect();
  });
  ffmpeg_process.on("exit", function (e) {
    console.log("child process exit" + e);
    socket.emit("fatal", "ffmpeg exit!" + e);
    socket.disconnect();
  });

  socket.on("push", (chunk) => {
    console.log("收到~~", chunk);
    if (!feedStream) {
      socket.emit("fatal", "rtmp not set yet.");
      ffmpeg_process.stdin.end();
      ffmpeg_process.kill("SIGINT");
      return;
    }
    feedStream(chunk);

    // socket.emit("push", 123);
  });

  // 當發生離線事件
  socket.on("disconnect", () => {
    console.log("Bye~"); // 顯示 bye~
  });
});

// 注意，這邊的 server 原本是 app
server.listen(3000, () => {
  console.log("Server Started. http://localhost:3000");
});
