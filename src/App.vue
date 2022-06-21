<template>
    <div id="app">
     <!--  <img src="./assets/logo.png" /> -->
        <router-view />
    </div>
</template>

<script>
function close() {}

export default {
    name: 'app'
};
</script>

<style>
 #app{
     overflow: hidden;
     padding:0;
     background: #000;
 }
</style>
