<script setup lang="ts">
import TheWelcome from '../components/TheWelcome.vue'
</script>

<template>
  <main>
    <TheWelcome />

    <div class="office-link">
      <h2>OnlyOffice 集成演示</h2>
      <p>体验文档查看、编辑和对比功能</p>
      <router-link to="/office" class="btn">
        进入 Office 演示
      </router-link>
    </div>
  </main>
</template>

<style scoped>
.office-link {
  max-width: 800px;
  margin: 40px auto;
  padding: 30px;
  text-align: center;
  background: #f9f9f9;
  border-radius: 8px;
}

.office-link h2 {
  color: #1890ff;
  margin-bottom: 10px;
}

.office-link p {
  color: #666;
  margin-bottom: 20px;
}

.btn {
  display: inline-block;
  padding: 12px 30px;
  background: #1890ff;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 16px;
  transition: background 0.3s;
}

.btn:hover {
  background: #40a9ff;
}
</style>
