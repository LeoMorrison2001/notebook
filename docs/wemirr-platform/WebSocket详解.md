# WebSocket 详解

> 模块路径: `wemirr-platform-framework/websocket-spring-boot-starter`
> 包路径: `com.wemirr.framework.websocket`

## 概述

`websocket-spring-boot-starter` 是基于 **Jakarta WebSocket** 的实时通信模块，提供：
- 内存/Redis 两种存储模式
- 心跳检测机制
- 连接事件监听
- 点对点发送 / 广播消息
- Redis 模式支持跨实例通信
- 离线消息存储

---

## 核心原理

### 通信模式

```
┌─────────────────────────────────────────────────────────────────┐
│                      客户端连接                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  前端                                                          │
│  const ws = new WebSocket('ws://localhost/ws?identifier=1001')  │
│                                                                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      WebSocket 服务端                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 连接建立                                                      │
│     │  ├─ 验证 identifier (用户ID)                               │
│     │  ├─ 创建 WebSocket 对象                                    │
│     │  └─ 存储到 WebSocketManager                                │
│     │                                                            │
│  2. 消息接收                                                      │
│     │  ├─ 判断是否是心跳 (ping)                                   │
│     │  ├─ 回复心跳 (pong)                                        │
│     │  └─ 触发 onMessage 回调                                     │
│     │                                                            │
│  3. 消息发送                                                      │
│     │  ├─ 点对点: sendMessage(identifier, message)              │
│     │  └─ 广播: broadcast(message)                                │
│     │                                                            │
│  4. 连接断开                                                      │
│     │  ├─ 触发 onClose                                            │
│     │  ├─ 移除 WebSocket 对象                                    │
│     │  └─ 发布 WebSocketCloseEvent                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
websocket/
├── WebSocket.java                      # WebSocket 包装类
├── WebSocketManager.java               # 管理器接口
├── BaseWebSocketEndpoint.java          # 端点基类
├── WebSocketConnectEvent.java          # 连接事件
├── WebSocketCloseEvent.java            # 断开事件
├── configuration/
│   ├── WebSocketProperties.java        # 配置属性
│   ├── WebSocketHeartBeatChecker.java  # 心跳检测
│   └── WebSocketSchedulingConfiguration.java
├── memory/
│   ├── EnableMemWebSocket.java         # 启用内存模式
│   └── MemWebSocketManager.java        # 内存管理器
├── redis/
│   ├── EnableRedisWebSocket.java       # 启用 Redis 模式
│   ├── RedisWebSocketManager.java      # Redis 管理器
│   └── action/                         # Redis 动作
│       ├── BroadCastAction.java        # 广播动作
│       ├── SendMessageAction.java      # 发送消息动作
│       └── RemoveAction.java           # 移除动作
└── utils/
    └── WebSocketUtil.java              # 工具类
```

---

## 存储模式对比

### 内存模式 (MEMORY)

```java
@EnableMemWebSocket
@SpringBootApplication
public class Application { }
```

**特点**:
- 连接存储在本地内存 (`ConcurrentHashMap`)
- 性能高，延迟低
- 适用于单实例部署
- 不支持跨实例通信

```
┌─────────────┐
│   实例 A    │
│ ┌─────────┐ │
│ │ 用户1   │ │
│ │ 用户2   │ │
│ └─────────┘ │
└─────────────┘
```

---

### Redis 模式 (REDIS)

```java
@EnableRedisWebSocket
@SpringBootApplication
public class Application { }
```

**特点**:
- Session 存储在本地，通过 Redis Pub/Sub 跨实例通信
- 支持多实例部署
- 支持离线消息（队列存储 7 天）
- 支持全局在线人数统计

```
┌─────────────┐    ┌──────────┐    ┌─────────────┐
│   实例 A    │    │  Redis   │    │   实例 B    │
│ ┌─────────┐ │    │          │    │ ┌─────────┐ │
│ │ 用户1   │ │◄──►│ Pub/Sub  │◄──►│ │ 用户3   │ │
│ │ 用户2   │ │    │          │    │ │ 用户4   │ │
│ └─────────┘ │    └──────────┘    │ └─────────┘ │
└─────────────┘                    └─────────────┘
```

---

## 使用示例

### 1. 创建 WebSocket 端点

```java
// 1. 定义端点（继承 BaseWebSocketEndpoint）
@Component
@ServerEndpoint(value = "/ws")  // WebSocket 连接地址
public class MyWebSocketEndpoint extends BaseWebSocketEndpoint {
    
    @OnOpen
    public void onOpen(Session session, @PathParam("identifier") String identifier) {
        // 连接建立
        connect(identifier, session);
        log.info("用户 {} 连接成功", identifier);
    }
    
    @OnMessage
    public void onMessage(String message, Session session) {
        // 获取 identifier
        String identifier = (String) session.getUserProperties().get("identifier");
        
        // 接收消息（自动处理心跳）
        receiveMessage(identifier, message, session);
    }
    
    @OnClose
    public void onClose(Session session) {
        // 连接关闭
        String identifier = (String) session.getUserProperties().get("identifier");
        disconnect(identifier);
    }
    
    @OnError
    public void onError(Session session, Throwable error) {
        log.error("WebSocket 错误", error);
    }
}

// 2. 启用 WebSocket（选择存储模式）
@EnableMemWebSocket  // 或 @EnableRedisWebSocket
@SpringBootApplication
public class Application { }
```

---

### 2. 前端连接

```javascript
// 1. 建立连接
const identifier = 'user_' + userId;  // 用户唯一标识
const ws = new WebSocket(`ws://localhost:8080/ws?identifier=${identifier}`);

// 2. 监听连接
ws.onopen = function() {
    console.log('WebSocket 连接成功');
    
    // 启动心跳（每30秒发送一次）
    setInterval(() => {
        ws.send('ping');
    }, 30000);
};

// 3. 监听消息
ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('收到消息:', data);
    
    // 处理心跳响应
    if (data === 'pong') {
        return;
    }
    
    // 处理业务消息
    handleMessage(data);
};

// 4. 监听关闭
ws.onclose = function() {
    console.log('WebSocket 连接关闭');
    // 可以实现重连逻辑
    setTimeout(() => reconnect(), 3000);
};

// 5. 监听错误
ws.onerror = function(error) {
    console.error('WebSocket 错误:', error);
};
```

---

### 3. 发送消息

```java
@Service
public class MessageService {
    
    @Autowired
    private WebSocketManager webSocketManager;
    
    // 1. 点对点发送
    public void sendToUser(String userId, String message) {
        webSocketManager.sendMessage(userId, message);
    }
    
    // 2. 广播消息（所有在线用户）
    public void broadcast(String message) {
        webSocketManager.broadcast(message);
    }
    
    // 3. 获取在线人数
    public int getOnlineCount() {
        return webSocketManager.size();
    }
}
```

---

### 4. 监听连接事件

```java
@Component
public class WebSocketEventListener {
    
    // 监听连接事件
    @EventListener
    public void onConnect(WebSocketConnectEvent event) {
        WebSocket ws = (WebSocket) event.getSource();
        log.info("用户 {} 连接成功", ws.getIdentifier());
        
        // 发送欢迎消息
        webSocketManager.sendMessage(ws.getIdentifier(), "欢迎连接！");
    }
    
    // 监听断开事件
    @EventListener
    public void onClose(WebSocketCloseEvent event) {
        WebSocket ws = (WebSocket) event.getSource();
        log.info("用户 {} 断开连接", ws.getIdentifier());
        
        // 更新用户在线状态
        userService.updateOnlineStatus(ws.getIdentifier(), false);
    }
}
```

---

### 5. 处理客户端消息

```java
@Service
public class WebSocketMessageService {
    
    @Autowired
    private WebSocketManager webSocketManager;
    
    // 重写 onMessage 处理业务消息
    public void handleMessage(String identifier, String message) {
        // 解析消息
        JsonObject msg = JsonParser.parseString(message).getAsJsonObject();
        String type = msg.get("type").getAsString();
        
        switch (type) {
            case "chat" -> {
                // 聊天消息
                String content = msg.get("content").getAsString();
                String toUserId = msg.get("toUserId").getAsString();
                webSocketManager.sendMessage(toUserId, content);
            }
            case "notification" -> {
                // 系统通知
                broadcast(message);
            }
        }
    }
}
```

---

## 配置说明

### application.yml

```yaml
spring:
  websocket:
    # 是否启用
    enabled: true
    
    # 存储模式: MEMORY 或 REDIS
    type: MEMORY
    
    # 心跳检测配置
    heart-check:
      # Cron 表达式：每30秒检查一次
      trigger: "30 * * * * ?"
      # 心跳超时时间（毫秒）
      time-span: 10000
      # 容忍错误次数
      error-toleration: 30
```

### 心跳机制

```
客户端                    服务端
  │                         │
  ├──── ping ─────────────►│ 更新心跳时间
  │                         │
  │◄─── pong ───────────────┤
  │                         │
  ├──── ping ─────────────►│
  │                         │
  │◄─── pong ───────────────┤
  │                         │
  │  (超过 30 秒无 ping)     │
  │                         ├─ 检测超时
  │                         ├─ 主动断开
  │◄─── close ───────────────┤
```

---

## Nginx 配置

如果使用 Nginx 反向代理，需要配置 WebSocket 支持：

```nginx
location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;  # 长连接超时
    proxy_send_timeout 3600s;
}
```

---

## 常见问题 (Q&A)

### Q1: 如何获取当前连接的用户信息？

**A**: 通过 Session 的 UserProperties 存储

```java
@OnOpen
public void onOpen(Session session, @PathParam("identifier") String identifier) {
    // 存储用户信息
    session.getUserProperties().put("identifier", identifier);
    session.getUserProperties().put("userId", getUserIdFromToken(identifier));
    session.getUserProperties().put("tenantId", getTenantId(identifier));
    
    connect(identifier, session);
}

// 在其他地方使用
String userId = (String) session.getUserProperties().get("userId");
```

---

### Q2: Redis 模式下如何处理离线消息？

**A**: 框架自动存储离线消息到 Redis 队列

```java
// 用户离线时发送消息
webSocketManager.sendMessage("user_123", "你好");

// 消息会被存储到 Redis
// Key: offline:messages:user_123
// Value: [{"action": "SendMessage", "message": "你好"}]
// TTL: 7 天

// 用户上线时自动发送
@Override
public void put(String identifier, WebSocket webSocket) {
    super.put(identifier, webSocket);
    
    // 自动获取并发送离线消息
    List<String> offlineMessages = getOfflineMessages(identifier);
    offlineMessages.forEach(msg -> {
        WebSocketUtil.sendMessage(webSocket.getSession(), msg);
    });
    
    // 清空离线消息队列
    clearOfflineMessages(identifier);
}
```

---

### Q3: 如何实现分组推送？

**A**: 使用 Redis 发布订阅或自己维护分组关系

```java
@Service
public class GroupMessageService {
    
    @Autowired
    private WebSocketManager webSocketManager;
    
    // 维护分组关系
    private Map<String, Set<String>> groupUsers = new ConcurrentHashMap<>();
    
    // 加入分组
    public void joinGroup(String userId, String groupId) {
        groupUsers.computeIfAbsent(groupId, k -> new HashSet<>()).add(userId);
    }
    
    // 组内广播
    public void sendToGroup(String groupId, String message) {
        Set<String> users = groupUsers.get(groupId);
        if (users != null) {
            users.forEach(userId -> {
                webSocketManager.sendMessage(userId, message);
            });
        }
    }
}
```

---

### Q4: 如何处理多端登录？

**A**: 使用设备标识区分连接

```java
// 连接时携带设备标识
ws://localhost/ws?identifier=user_123&device=web
ws://localhost/ws?identifier=user_123&device=app

// 存储时区分设备
String key = identifier + ":" + device;  // user_123:web
connect(key, session);

// 管理多个连接
Map<String, Set<String>> userDevices = new ConcurrentHashMap<>();
userDevices.computeIfAbsent(userId, k -> new HashSet<>()).add(device);

// 给用户所有设备发送消息
Set<String> devices = userDevices.get(userId);
devices.forEach(device -> {
    String key = userId + ":" + device;
    webSocketManager.sendMessage(key, message);
});
```

---

### Q5: 如何实现消息确认机制？

**A**: 客户端收到消息后发送确认

```javascript
// 客户端
ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    const msgId = data.msgId;
    
    // 发送确认
    ws.send(JSON.stringify({
        type: 'ack',
        msgId: msgId
    }));
    
    // 处理业务逻辑
    handleMessage(data);
};
```

```java
// 服务端
@Override
public void onMessage(String identifier, String message) {
    JsonObject msg = JsonParser.parseString(message).getAsJsonObject();
    String type = msg.get("type").getAsString();
    
    if ("ack".equals(type)) {
        String msgId = msg.get("msgId").getAsString();
        // 标记消息已确认
        messageService.ackMessage(msgId);
    }
}
```

---

## 学习建议

1. **选择合适模式**: 单实例用内存，多实例用 Redis
2. **实现心跳机制**: 保持连接活跃，及时清理死连接
3. **处理断线重连**: 前端实现自动重连逻辑
4. **注意安全性**: 验证连接身份，防止未授权访问

---

## 下一步学习

- [国际化](../wemirr-platform-framework/i18n-spring-boot-starter) - 多语言支持
- [PDF 处理](../wemirr-platform-framework/pdf-spring-boot-starter) - PDF 生成
- [MongoDB](../wemirr-platform-framework/mongodb-plus-spring-boot-starter) - NoSQL 支持
