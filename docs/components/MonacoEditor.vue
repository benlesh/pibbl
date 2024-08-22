<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import * as monaco from "monaco-editor";
import './monaco';
import * as ts from "typescript";
import { buildExampleHTML } from "./build-example-html";

const iframeRef = ref(null);
const editorRef = ref(null)
const editorContent = ref('console.log("Hello World")');
const language = 'javascript';

onMounted(() => {
    iframeRef.value.contentDocument.body.innerHTML = buildExampleHTML('whut');
    const editor = monaco.editor.create(
        document.querySelector('#editor'), {
        value: editorContent.value,
        language,
    }
    );

    editor.onDidChangeModelContent(async () => {
        try {
            editorContent.value = await compileTS(editor.getValue());
        } catch (error) {
            console.error('Could not compile', error);
        }
    });
});

watch(() => editorContent.value, (value) => {
    // iframeRef.value.contentDocument.body.innerHTML = buildExampleHTML(value);
});


function createExampleURL(html: string) {
    const blob = new Blob([html], { type: "text/html" });
    return URL.createObjectURL(blob);
}

async function compileTS(tsSrc: string): Promise<string> {
    try {
        const result = ts.transpileModule(tsSrc, {
            compilerOptions: { module: ts.ModuleKind.ESNext }
        });
        return result.outputText;
    } catch (error) {
        console.error(error);
        throw new Error('Could not compile TypeScript', { cause: error });
    }
}
</script>

<template>
    <div ref="editorRef" id="editor" style="width: 800px; height: 600px"></div>
    <iframe ref="iframeRef" src="about:blank"></iframe>
</template>